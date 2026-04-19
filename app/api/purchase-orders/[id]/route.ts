// [FEATURE: purchase_orders]
// GET/PATCH/DELETE a single Purchase Order.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const STATUS_TRANSITIONS: Record<string, string | null> = {
  draft: "submitted",
  submitted: "partial_received",
  partial_received: "received",
  received: "invoiced",
  invoiced: null,
};

const patchSchema = z.object({
  status: z.enum(["draft", "submitted", "partial_received", "received", "invoiced"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      lines: { include: { inventory: { select: { partNumber: true, quantityOnHand: true } } } },
    },
  });
  if (!order || order.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!order || order.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const now = new Date();
  const data: Record<string, unknown> = {};

  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "submitted") data.submittedAt = now;
    if (parsed.data.status === "received") data.receivedAt = now;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const updated = await prisma.purchaseOrder.update({ where: { id }, data });
  return NextResponse.json({ order: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!order || order.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "draft") {
    return NextResponse.json({ error: "Can only delete draft purchase orders" }, { status: 400 });
  }

  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
