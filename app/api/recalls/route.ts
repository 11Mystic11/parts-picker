// [FEATURE: recall_check]
// GET /api/recalls?vin=... — proxies NHTSA recall API and caches count on RO.
// GET /api/recalls?roId=... — fetches for an RO's VIN and caches the result.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRecallsByVin } from "@/lib/recalls/check";

const CACHE_DAYS = 7;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const roId = req.nextUrl.searchParams.get("roId");
  const rawVin = req.nextUrl.searchParams.get("vin");

  let vin = rawVin;

  // If roId provided, look up VIN and check cache
  if (roId) {
    const ro = await prisma.repairOrder.findUnique({
      where: { id: roId },
      select: { vin: true, rooftopId: true, openRecallCount: true, recallCheckedAt: true },
    });
    if (!ro || ro.rooftopId !== user.rooftopId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    vin = ro.vin;

    // Return cached result if fresh
    if (ro.recallCheckedAt) {
      const age = Date.now() - new Date(ro.recallCheckedAt).getTime();
      if (age < CACHE_DAYS * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ vin, count: ro.openRecallCount ?? 0, cached: true });
      }
    }
  }

  if (!vin) return NextResponse.json({ error: "vin or roId required" }, { status: 400 });

  try {
    const campaigns = await fetchRecallsByVin(vin);
    const count = campaigns.length;

    // Cache on RO if roId was provided
    if (roId) {
      await prisma.repairOrder.update({
        where: { id: roId },
        data: { openRecallCount: count, recallCheckedAt: new Date() },
      });
    }

    return NextResponse.json({ vin, count, campaigns });
  } catch {
    return NextResponse.json({ error: "NHTSA API unavailable" }, { status: 502 });
  }
}
