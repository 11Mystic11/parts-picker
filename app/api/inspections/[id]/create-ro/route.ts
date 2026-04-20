// POST /api/inspections/[id]/create-ro — create a new RO from flagged inspection issues

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// Items to include as "concern" line items on the new RO
const schema = z.object({
  // Template item IDs whose values indicate issues
  flaggedItemIds: z.array(z.string()).min(1, "Select at least one flagged item"),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  lotVehicleId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const insp = await db.roInspection.findUnique({
    where: { id },
    include: {
      template: { select: { name: true } },
      tech: { select: { rooftopId: true } },
      results: { include: { templateItem: { select: { id: true, label: true } } } },
    },
  });
  if (!insp || insp.tech?.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (insp.repairOrderId) {
    return NextResponse.json({ error: "Inspection already linked to an RO" }, { status: 409 });
  }

  const { flaggedItemIds, customerName, customerPhone, customerEmail, customerId, lotVehicleId } = parsed.data;

  // Resolve flagged items with labels
  const flaggedResults = insp.results.filter((r) =>
    flaggedItemIds.includes(r.templateItem.id)
  );
  if (flaggedResults.length === 0) {
    return NextResponse.json({ error: "No matching flagged items found" }, { status: 400 });
  }

  // Build vehicle snapshot from inspection context
  let vehicleSnapshot = "{}";
  if (lotVehicleId) {
    const lv = await db.lotVehicle.findUnique({
      where: { id: lotVehicleId },
      select: { year: true, make: true, model: true, trim: true },
    });
    if (lv) {
      vehicleSnapshot = JSON.stringify({ year: lv.year, make: lv.make, model: lv.model, trim: lv.trim });
    }
  } else if (insp.vehicleLabel) {
    // Parse rough year/make/model from vehicleLabel if possible
    vehicleSnapshot = JSON.stringify({ label: insp.vehicleLabel });
  }

  // Generate RO number
  const count = await db.repairOrder.count({ where: { rooftopId: user.rooftopId ?? "" } });
  const roNumber = `RO-${String(count + 1).padStart(6, "0")}`;

  // Create the RO with concern line items from flagged inspection results
  const ro = await db.repairOrder.create({
    data: {
      rooftopId: user.rooftopId ?? "",
      advisorId: user.id,
      roNumber,
      vin: insp.vin ?? "",
      vehicleSnapshot,
      status: "draft",
      vehicleType: lotVehicleId ? "lot" : "customer",
      lotVehicleId: lotVehicleId ?? null,
      customerId: customerId ?? null,
      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      customerEmail: customerEmail ?? null,
      partsSubtotal: 0,
      laborSubtotal: 0,
      shopSupplyFee: 0,
      taxAmount: 0,
      totalAmount: 0,
      lineItems: {
        create: flaggedResults.map((r, idx) => ({
          type: "labor",
          source: "manual",
          description: `${r.templateItem.label}${r.notes ? ` — ${r.notes}` : ""}`,
          quantity: 1,
          unitCost: 0,
          unitPrice: 0,
          totalPrice: 0,
          sortOrder: idx,
        })),
      },
    },
  });

  // Link the inspection to the new RO
  await db.roInspection.update({
    where: { id },
    data: { repairOrderId: ro.id },
  });

  return NextResponse.json({ ro }, { status: 201 });
}
