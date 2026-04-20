// GET  /api/lot-vehicles        — list lot vehicles for rooftop
// POST /api/lot-vehicles        — create a single lot vehicle

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  vin: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  licensePlate: z.string().optional(),
  stockNumber: z.string().optional(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  status: z.enum(["available", "in_service", "sold"]).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ vehicles: [] });

  const status = req.nextUrl.searchParams.get("status");

  const vehicles = await db.lotVehicle.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ vehicles });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const vehicle = await db.lotVehicle.create({
    data: { rooftopId: user.rooftopId, ...parsed.data },
  });

  return NextResponse.json({ vehicle }, { status: 201 });
}
