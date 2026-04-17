// [FEATURE: customer_approval_portal]
// GET /api/portal/[token] — public endpoint (no auth required).
// Returns the RO summary and line items for the customer approval portal.
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const record = await db.rOApprovalToken.findUnique({
    where: { token },
    include: {
      repairOrder: {
        include: {
          lineItems: { orderBy: { sortOrder: "asc" } },
          lineDecisions: true,
        },
      },
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This approval link has expired" }, { status: 410 });
  }

  const ro = record.repairOrder;
  let vehicle: Record<string, unknown> = {};
  try { vehicle = JSON.parse(ro.vehicleSnapshot); } catch { /* ignore */ }

  const decisionMap = new Map(
    ro.lineDecisions.map((d) => [d.lineItemId, d.decision])
  );

  return NextResponse.json({
    roNumber: ro.roNumber,
    customerName: ro.customerName,
    vehicle: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      vin: vehicle.vin,
    },
    status: ro.status,
    partsSubtotal: ro.partsSubtotal,
    laborSubtotal: ro.laborSubtotal,
    shopSupplyFee: ro.shopSupplyFee,
    taxAmount: ro.taxAmount,
    totalAmount: ro.totalAmount,
    lineItems: ro.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
      partNumber: li.partNumber,
      decision: decisionMap.get(li.id) ?? null,
    })),
  });
}
