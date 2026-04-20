// POST /api/inspections/[id]/link-ro — link a standalone inspection to an existing RO

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ roId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const insp = await db.roInspection.findUnique({
    where: { id },
    include: { tech: { select: { rooftopId: true } } },
  });
  if (!insp || insp.tech?.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (insp.repairOrderId) {
    return NextResponse.json({ error: "Inspection already linked to an RO" }, { status: 409 });
  }

  const ro = await db.repairOrder.findUnique({
    where: { id: parsed.data.roId },
    select: { rooftopId: true },
  });
  if (!ro || ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "RO not found" }, { status: 404 });
  }

  const updated = await db.roInspection.update({
    where: { id },
    data: { repairOrderId: parsed.data.roId },
  });

  return NextResponse.json({ inspection: updated });
}
