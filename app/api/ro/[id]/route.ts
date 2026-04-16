import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { prisma as db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/ro/[id] — fetch RO with line items
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      advisor: { select: { name: true, email: true } },
      overrides: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ro });
}

// ─── Patch Schema ──────────────────────────────────────────────────────────────

const addLineItemSchema = z.object({
  action: z.literal("addLineItem"),
  supplier: z.string().optional(),
  partNumber: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive().default(1),
  unitCost: z.number().min(0).default(0),
  unitPrice: z.number().min(0),
});

const removeLineItemSchema = z.object({
  action: z.literal("removeLineItem"),
  lineItemId: z.string(),
});

const patchSchema = z.object({
  notes: z.string().optional(),
  wizardStep: z.number().int().min(1).max(5).optional(),
  status: z.enum(["presented", "approved", "closed", "void"]).optional(),
  lineItemOverrides: z
    .array(
      z.object({
        lineItemId: z.string(),
        field: z.enum(["unitPrice", "quantity", "description"]),
        newValue: z.string(),
        reason: z.string().optional(),
      })
    )
    .optional(),
});

/** Valid RO status transitions (state machine). */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:     ["presented", "void"],
  presented: ["approved", "void"],
  approved:  ["closed", "void"],
  closed:    [],
  void:      [],
};

// PATCH /api/ro/[id] — update notes, step, status, or apply line item overrides
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── addLineItem action ─────────────────────────────────────────────────────
  const bodyObj = body as Record<string, unknown>;
  if (bodyObj?.action === "addLineItem") {
    if (ro.status !== "draft") {
      return NextResponse.json({ error: "Can only add parts to a draft RO" }, { status: 400 });
    }
    const parsedAdd = addLineItemSchema.safeParse(body);
    if (!parsedAdd.success) {
      return NextResponse.json({ error: parsedAdd.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    const { supplier, partNumber, description, quantity, unitCost, unitPrice } = parsedAdd.data;
    const totalPrice = quantity * unitPrice;
    const maxSort = ro.lineItems.reduce((m, li) => Math.max(m, li.sortOrder), 0);

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.rOLineItem.create({
        data: {
          repairOrderId: id,
          type: "part",
          source: "manual",
          supplier: supplier ?? null,
          partNumber: partNumber ?? null,
          description,
          quantity,
          unitCost,
          unitPrice,
          totalPrice,
          sortOrder: maxSort + 1,
        },
      });

      // Recalculate totals
      const updatedItems = await tx.rOLineItem.findMany({ where: { repairOrderId: id } });
      const partsSubtotal = updatedItems.filter((li) => li.type === "part").reduce((s, li) => s + li.totalPrice, 0);
      const laborSubtotal = updatedItems.filter((li) => li.type === "labor").reduce((s, li) => s + li.totalPrice, 0);
      const shopSupplyFee = updatedItems.filter((li) => li.type === "fee").reduce((s, li) => s + li.totalPrice, 0);
      const taxAmount     = updatedItems.filter((li) => li.type === "tax").reduce((s, li) => s + li.totalPrice, 0);
      const totalAmount   = partsSubtotal + laborSubtotal + shopSupplyFee + taxAmount;
      await tx.repairOrder.update({ where: { id }, data: { partsSubtotal, laborSubtotal, shopSupplyFee, taxAmount, totalAmount } });
    });

    const updated = await db.repairOrder.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ ro: updated });
  }

  // ── removeLineItem action ──────────────────────────────────────────────────
  if (bodyObj?.action === "removeLineItem") {
    if (ro.status !== "draft") {
      return NextResponse.json({ error: "Can only remove parts from a draft RO" }, { status: 400 });
    }
    const parsedRemove = removeLineItemSchema.safeParse(body);
    if (!parsedRemove.success) {
      return NextResponse.json({ error: "lineItemId is required" }, { status: 400 });
    }
    const { lineItemId } = parsedRemove.data;
    const item = ro.lineItems.find((li) => li.id === lineItemId);
    if (!item) return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    if (item.source !== "manual") {
      return NextResponse.json({ error: "Only manually-added items can be removed" }, { status: 400 });
    }

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.rOLineItem.delete({ where: { id: lineItemId } });

      const updatedItems = await tx.rOLineItem.findMany({ where: { repairOrderId: id } });
      const partsSubtotal = updatedItems.filter((li) => li.type === "part").reduce((s, li) => s + li.totalPrice, 0);
      const laborSubtotal = updatedItems.filter((li) => li.type === "labor").reduce((s, li) => s + li.totalPrice, 0);
      const shopSupplyFee = updatedItems.filter((li) => li.type === "fee").reduce((s, li) => s + li.totalPrice, 0);
      const taxAmount     = updatedItems.filter((li) => li.type === "tax").reduce((s, li) => s + li.totalPrice, 0);
      const totalAmount   = partsSubtotal + laborSubtotal + shopSupplyFee + taxAmount;
      await tx.repairOrder.update({ where: { id }, data: { partsSubtotal, laborSubtotal, shopSupplyFee, taxAmount, totalAmount } });
    });

    const updated = await db.repairOrder.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ ro: updated });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { notes, wizardStep, status, lineItemOverrides } = parsed.data;

  // Guard: content edits only allowed on draft
  if (!status && ro.status !== "draft") {
    return NextResponse.json({ error: "Cannot modify a non-draft RO" }, { status: 400 });
  }

  // Guard: validate status transition
  if (status) {
    const allowed = VALID_TRANSITIONS[ro.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition RO from "${ro.status}" to "${status}"` },
        { status: 400 }
      );
    }
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Apply line item overrides
    if (lineItemOverrides?.length) {
      for (const override of lineItemOverrides) {
        const item = ro.lineItems.find((li) => li.id === override.lineItemId);
        if (!item) continue;

        const oldValue = String(item[override.field as keyof typeof item] ?? "");
        const updateData: Record<string, unknown> = {};

        if (override.field === "unitPrice") {
          const price = parseFloat(override.newValue);
          if (isNaN(price)) continue;
          updateData.unitPrice = price;
          updateData.totalPrice = price * item.quantity;
        } else if (override.field === "quantity") {
          const qty = parseFloat(override.newValue);
          if (isNaN(qty)) continue;
          updateData.quantity = qty;
          updateData.totalPrice = item.unitPrice * qty;
        } else {
          updateData.description = override.newValue;
        }

        await tx.rOLineItem.update({ where: { id: item.id }, data: updateData });
        await tx.rOOverride.create({
          data: {
            repairOrderId: id,
            lineItemId: item.id,
            advisorId: user.id,
            field: override.field,
            oldValue,
            newValue: override.newValue,
            reason: override.reason ?? null,
          },
        });
      }

      // Recalculate totals
      const updatedItems = await tx.rOLineItem.findMany({ where: { repairOrderId: id } });
      const partsSubtotal = updatedItems.filter((li) => li.type === "part").reduce((s, li) => s + li.totalPrice, 0);
      const laborSubtotal = updatedItems.filter((li) => li.type === "labor").reduce((s, li) => s + li.totalPrice, 0);
      const shopSupplyFee = updatedItems.filter((li) => li.type === "fee").reduce((s, li) => s + li.totalPrice, 0);
      const taxAmount     = updatedItems.filter((li) => li.type === "tax").reduce((s, li) => s + li.totalPrice, 0);
      const totalAmount   = partsSubtotal + laborSubtotal + shopSupplyFee + taxAmount;
      await tx.repairOrder.update({ where: { id }, data: { partsSubtotal, laborSubtotal, shopSupplyFee, taxAmount, totalAmount } });
    }

    // Apply scalar updates
    const roUpdates: Record<string, unknown> = {};
    if (notes !== undefined)      roUpdates.notes = notes;
    if (wizardStep !== undefined) roUpdates.wizardStep = wizardStep;
    if (status !== undefined) {
      roUpdates.status = status;
      if (status === "presented") roUpdates.presentedAt = new Date();
      if (status === "closed")    roUpdates.closedAt = new Date();
      if (status === "approved")  roUpdates.dmsSyncStatus = "pending";
    }
    if (Object.keys(roUpdates).length > 0) {
      await tx.repairOrder.update({ where: { id }, data: roUpdates });
    }

    // Audit status change
    if (status) {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          rooftopId: user.rooftopId!,
          repairOrderId: id,
          action: `ro.status.${status}`,
          entityType: "RepairOrder",
          entityId: id,
          diff: JSON.stringify({ from: ro.status, to: status }),
        },
      });
    }
  });

  // Fire-and-forget DMS sync when RO is approved
  if (status === "approved") {
    triggerDMSSync(id, user.id, user.rooftopId!).catch((err) =>
      console.error("[DMS] Auto-sync error for RO", id, err)
    );
  }

  const updated = await db.repairOrder.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ ro: updated });
}

// ─── DMS Auto-Sync (fire-and-forget) ──────────────────────────────────────────

async function triggerDMSSync(roId: string, userId: string, rooftopId: string) {
  // Feature flag guard — if dms_sync is disabled for this rooftop, skip live push
  const { flagEnabled } = await import("@/lib/flags/evaluate");
  const dmsSyncEnabled = await flagEnabled("dms_sync", rooftopId);
  if (!dmsSyncEnabled) {
    console.log(`[DMS] dms_sync flag is off for rooftop ${rooftopId} — skipping sync for RO ${roId}`);
    return;
  }

  const { getDMSAdapter } = await import("@/lib/dms/adapter");

  const ro = await db.repairOrder.findUnique({
    where: { id: roId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      advisor: { select: { name: true, employeeId: true } },
      rooftop: { select: { dmsProvider: true, dmsConfig: true } },
    },
  });
  if (!ro) return;

  const adapter = await getDMSAdapter(ro.rooftop);
  if (!adapter) return; // DMS not configured — nothing to do

  const payload = {
    roId: ro.id,
    vin: ro.vin,
    advisorName: ro.advisor.name ?? "Unknown",
    advisorEmployeeId: ro.advisor.employeeId,
    currentMileage: ro.currentMileage,
    status: ro.status,
    partsSubtotal: ro.partsSubtotal,
    laborSubtotal: ro.laborSubtotal,
    shopSupplyFee: ro.shopSupplyFee,
    taxAmount: ro.taxAmount,
    totalAmount: ro.totalAmount,
    notes: ro.notes,
    lineItems: ro.lineItems.map((li) => ({
      type: li.type,
      description: li.description,
      partNumber: li.partNumber,
      laborOpCode: li.laborOpCode,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
    })),
    createdAt: ro.createdAt,
    approvedAt: new Date(),
  };

  const result = await adapter.pushRO(payload);

  await db.repairOrder.update({
    where: { id: roId },
    data: {
      dmsSyncStatus:   result.success ? "synced" : "failed",
      dmsSyncedAt:     result.success ? new Date() : undefined,
      dmsExternalId:   result.success ? result.externalId : undefined,
      dmsSyncAttempts: { increment: 1 },
    },
  });

  await db.auditLog.create({
    data: {
      userId,
      rooftopId,
      repairOrderId: roId,
      action: result.success ? "ro.dms_sync.success" : "ro.dms_sync.failed",
      entityType: "RepairOrder",
      entityId: roId,
      diff: JSON.stringify({ result, triggeredBy: "auto" }),
    },
  });
}
