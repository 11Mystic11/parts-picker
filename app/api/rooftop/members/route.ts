// GET /api/rooftop/members — list all users in the current rooftop
// Available to any authenticated user (for dropdowns, assignment, etc.)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const members = await db.user.findMany({
    where: { rooftopId: user.rooftopId },
    select: { id: true, name: true, role: true, employeeId: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ members });
}
