// [FEATURE: dvi]
// GET  /api/ro/[id]/dvi — fetch (or auto-create) the DVIReport for this RO
// PUT  /api/ro/[id]/dvi — update report status (e.g. mark complete)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { createDefaultDVIReport } from "@/lib/dvi/create-report";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("dvi" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch or auto-create
  let report = await db.dVIReport.findUnique({
    where: { repairOrderId: id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!report) {
    const reportId = await createDefaultDVIReport(id, user.id, ro.lineItems);
    report = await db.dVIReport.findUnique({
      where: { id: reportId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  return NextResponse.json({ report });
}

const putSchema = z.object({
  status: z.enum(["in_progress", "complete"]),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("dvi" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const report = await db.dVIReport.update({
    where: { repairOrderId: id },
    data: { status: parsed.data.status },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ report });
}
