// PATCH /api/ro/[id]/line-items/[itemId] — update tags on a line item

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string; itemId: string }> };

const patchSchema = z.object({
  tags: z.array(z.string()),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id: roId, itemId } = await params;

  const ro = await db.repairOrder.findUnique({ where: { id: roId }, select: { rooftopId: true } });
  if (!ro || ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const updated = await db.rOLineItem.update({
    where: { id: itemId },
    data: { tags: JSON.stringify(parsed.data.tags) },
  });

  return NextResponse.json({ tags: JSON.parse(updated.tags) });
}
