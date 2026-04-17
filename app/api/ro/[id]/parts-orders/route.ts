// [FEATURE: parts_ordering]
// GET  /api/ro/[id]/parts-orders — list orders for this RO
// POST /api/ro/[id]/parts-orders — submit a new parts order
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { getSupplierAdapter } from "@/lib/parts-ordering/factory";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  supplier: z.string().min(1),
  items: z
    .array(
      z.object({
        partNumber: z.string().min(1),
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
      })
    )
    .min(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("parts_ordering" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await db.partsOrder.findMany({
    where: { repairOrderId: id },
    include: { placedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("parts_ordering" as any, user.rooftopId);
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { supplier, items } = parsed.data;

  // Create order record first
  const order = await db.partsOrder.create({
    data: {
      repairOrderId: id,
      rooftopId: user.rooftopId!,
      placedById: user.id,
      supplier,
      items: JSON.stringify(items),
      status: "pending",
    },
  });

  // Call supplier adapter
  const adapter = getSupplierAdapter(supplier, null);
  const result = await adapter.submitOrder(items);

  // Update with result
  const updated = await db.partsOrder.update({
    where: { id: order.id },
    data: {
      status: result.success ? "submitted" : "error",
      externalOrderId: result.externalOrderId ?? null,
      errorMessage: result.error ?? null,
      submittedAt: result.success ? new Date() : null,
    },
  });

  return NextResponse.json({ order: updated }, { status: 201 });
}
