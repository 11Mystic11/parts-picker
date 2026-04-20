// [FEATURE: canned_inspections]
// GET  /api/ro/[id]/inspections — list inspections attached to this RO
// POST /api/ro/[id]/inspections — manually attach a template to this RO
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inspections = await db.roInspection.findMany({
    where: { repairOrderId: id },
    include: {
      template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      results: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ inspections });
}

const attachSchema = z.object({
  templateId: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const template = await db.inspectionTemplate.findUnique({
    where: { id: parsed.data.templateId },
    include: { items: true },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Check not already attached
  const existing = await db.roInspection.findFirst({
    where: { repairOrderId: id, templateId: template.id },
  });
  if (existing) return NextResponse.json({ error: "Template already attached to this RO" }, { status: 409 });

  const inspection = await db.roInspection.create({
    data: {
      repairOrderId: id,
      templateId: template.id,
      techId: user.id,
      results: {
        create: template.items.map((item) => ({
          templateItemId: item.id,
          value: null,
          notes: null,
          updatedAt: new Date(),
        })),
      },
    },
    include: { results: true },
  });

  return NextResponse.json({ inspection }, { status: 201 });
}
