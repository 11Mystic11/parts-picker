// [FEATURE: parts_ordering]
// PATCH /api/ro/[id]/parts-orders/[orderId] — refresh order status from supplier
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { getSupplierAdapter } from "@/lib/parts-ordering/factory";

type Params = { params: Promise<{ id: string; orderId: string }> };

export async function PATCH(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id, orderId } = await params;

  const enabled = await flagEnabled("parts_ordering" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await db.partsOrder.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!order.externalOrderId) {
    return NextResponse.json({ error: "No external order ID to look up" }, { status: 400 });
  }

  const adapter = getSupplierAdapter(order.supplier, null);
  const status = await adapter.getOrderStatus(order.externalOrderId);

  const statusMap: Record<string, string> = {
    confirmed: "confirmed",
    shipped: "confirmed",
    delivered: "confirmed",
    cancelled: "error",
  };

  const updated = await db.partsOrder.update({
    where: { id: orderId },
    data: {
      status: statusMap[status.status] ?? order.status,
    },
  });

  return NextResponse.json({ order: updated, supplierStatus: status });
}
