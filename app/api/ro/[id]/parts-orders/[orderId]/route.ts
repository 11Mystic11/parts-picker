// [FEATURE: parts_ordering]
// PATCH /api/ro/[id]/parts-orders/[orderId] — refresh order status or update backorder info.
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { getSupplierAdapter } from "@/lib/parts-ordering/factory";
import { z } from "zod";

type Params = { params: Promise<{ id: string; orderId: string }> };

const patchSchema = z.object({
  // [FEATURE: backorder_tracking] — manual backorder update
  isBackordered: z.boolean().optional(),
  backorderEta: z.string().datetime().nullable().optional(),
  refreshStatus: z.boolean().optional(), // if true, call supplier API
}).optional();

export async function PATCH(req: NextRequest, { params }: Params) {
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

  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const parsed = patchSchema.safeParse(body);

  // Manual backorder update
  if (parsed.success && parsed.data && (parsed.data.isBackordered !== undefined || parsed.data.backorderEta !== undefined)) {
    const updated = await db.partsOrder.update({
      where: { id: orderId },
      data: {
        isBackordered: parsed.data.isBackordered ?? order.isBackordered,
        backorderEta: parsed.data.backorderEta !== undefined
          ? (parsed.data.backorderEta ? new Date(parsed.data.backorderEta) : null)
          : order.backorderEta,
      },
    });
    return NextResponse.json({ order: updated });
  }

  // Default: refresh status from supplier API
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
    data: { status: statusMap[status.status] ?? order.status },
  });

  return NextResponse.json({ order: updated, supplierStatus: status });
}
