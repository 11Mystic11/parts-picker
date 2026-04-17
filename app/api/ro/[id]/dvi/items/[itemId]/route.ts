// [FEATURE: dvi]
// PATCH /api/ro/[id]/dvi/items/[itemId] — update a single DVIItem (condition, notes)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

type Params = { params: Promise<{ id: string; itemId: string }> };

const patchSchema = z.object({
  condition: z.enum(["ok", "advisory", "critical"]).optional(),
  notes: z.string().optional().nullable(),
  label: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id, itemId } = await params;

  const enabled = await flagEnabled("dvi" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  // Verify RO ownership
  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.condition !== undefined) updateData.condition = parsed.data.condition;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label;

  const item = await db.dVIItem.update({
    where: { id: itemId },
    data: updateData,
  });

  return NextResponse.json({ item });
}
