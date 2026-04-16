import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

/**
 * GET /api/admin/rooftops
 * Returns all rooftops in the session user's organization.
 * Used by the feature flags admin UI for the rooftop scope selector.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; organizationId?: string };
  if (user.role !== "admin" && user.role !== "developer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ rooftops: [] });
  }

  const rooftops = await db.rooftop.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ rooftops });
}
