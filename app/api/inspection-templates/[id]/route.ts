// [FEATURE: canned_inspections]
// PUT    /api/inspection-templates/[id] — replace template + items
// DELETE /api/inspection-templates/[id] — soft-delete (isActive = false)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const itemSchema = z.object({
  label: z.string().min(1),
  checkType: z.enum(["condition", "passfail", "measurement"]).default("condition"),
  unit: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

const putSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  triggerMileage: z.number().int().positive().optional().nullable(),
  triggerWindow: z.number().int().positive().optional().nullable(),
  items: z.array(itemSchema).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };

  if (!["admin", "manager", "developer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enabled = await flagEnabled("canned_inspections" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { name, description, triggerMileage, triggerWindow, items } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (triggerMileage !== undefined) updateData.triggerMileage = triggerMileage;
  if (triggerWindow !== undefined) updateData.triggerWindow = triggerWindow;

  // If items provided, replace all items
  if (items !== undefined) {
    await db.inspectionTemplateItem.deleteMany({ where: { templateId: id } });
    if (items.length > 0) {
      await db.inspectionTemplateItem.createMany({
        data: items.map((item) => ({
          templateId: id,
          label: item.label,
          checkType: item.checkType,
          unit: item.unit ?? null,
          sortOrder: item.sortOrder,
        })),
      });
    }
  }

  const template = await db.inspectionTemplate.update({
    where: { id },
    data: updateData,
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ template });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };

  if (!["admin", "developer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await db.inspectionTemplate.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
