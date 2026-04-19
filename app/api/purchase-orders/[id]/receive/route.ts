// [FEATURE: purchase_orders]
// POST — receive items on a PO: updates qtyReceived per line, bumps inventory, creates InventoryMovement.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const receiveSchema = z.object({
  lines: z.array(z.object({
    id: z.string(),
    qtyReceived: z.number().min(0),
  })).min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!order || order.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!["submitted", "partial_received"].includes(order.status)) {
    return NextResponse.json({ error: "Order must be submitted or partial_received to receive items" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = receiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const lineUpdate of parsed.data.lines) {
      const line = order.lines.find((l) => l.id === lineUpdate.id);
      if (!line) continue;

      const newQtyReceived = Math.min(lineUpdate.qtyReceived, line.qtyOrdered);
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { qtyReceived: newQtyReceived },
      });

      // If this line is linked to inventory, bump the on-hand quantity
      if (line.inventoryId && newQtyReceived > line.qtyReceived) {
        const delta = newQtyReceived - line.qtyReceived;
        const currentInventory = await tx.partInventory.findUnique({
          where: { id: line.inventoryId },
          select: { quantityOnHand: true },
        });
        const prevQty = currentInventory?.quantityOnHand ?? 0;
        const newQty = prevQty + delta;

        await tx.partInventory.update({
          where: { id: line.inventoryId },
          data: { quantityOnHand: newQty },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryId: line.inventoryId,
            type: "receive",
            quantity: delta,
            previousQty: prevQty,
            newQty,
            reason: `PO receive — ${order.supplier} PO ${id.slice(-8).toUpperCase()}`,
            referenceId: id,
            performedById: user.id,
          },
        });
      }
    }

    // Determine new PO status: check if all lines fully received
    const updatedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: id } });
    const allReceived = updatedLines.every((l) => l.qtyReceived >= l.qtyOrdered);
    const anyReceived = updatedLines.some((l) => l.qtyReceived > 0);

    let newStatus = order.status;
    if (allReceived) {
      newStatus = "received";
    } else if (anyReceived) {
      newStatus = "partial_received";
    }

    if (newStatus !== order.status) {
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "received" ? { receivedAt: new Date() } : {}),
        },
      });
    }
  });

  return NextResponse.json({ success: true });
}
