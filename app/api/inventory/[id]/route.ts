import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

const CATEGORIES = ["Filters", "Fluids", "Brakes", "Batteries", "Belts", "Ignition", "Wipers", "Other"] as const;
const MOVEMENT_TYPES = ["receive", "use", "adjust", "return"] as const;

const updateSchema = z.object({
  partNumber: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.enum(CATEGORIES).optional(),
  supplier: z.string().optional().nullable(),
  unitCost: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  reorderPoint: z.number().min(0).optional(),
  reorderQty: z.number().min(0).optional(),
  location: z.string().optional().nullable(),
});

const adjustSchema = z.object({
  action: z.literal("adjust"),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().positive("Quantity must be positive"),
  reason: z.string().optional(),
  referenceId: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/inventory/[id] — single item with last 20 movements
export async function GET(
  req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const item = await db.partInventory.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { performedBy: { select: { name: true, employeeId: true } } },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.rooftopId !== user.rooftopId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ item });
}

// PATCH /api/inventory/[id] — update fields OR record a movement
export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  const { id } = await params;

  const item = await db.partInventory.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.rooftopId !== user.rooftopId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Stock adjustment action
  const bodyObj = body as Record<string, unknown>;
  if (bodyObj?.action === "adjust") {
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { type, quantity, reason, referenceId } = parsed.data;
    // For use/adjust-out, qty is negative; for receive/return, positive
    const delta = (type === "use") ? -quantity : quantity;
    const newQty = Math.max(0, item.quantityOnHand + delta);

    const [updated] = await db.$transaction([
      db.partInventory.update({
        where: { id },
        data: { quantityOnHand: newQty },
      }),
      db.inventoryMovement.create({
        data: {
          inventoryId: id,
          type,
          quantity: delta,
          previousQty: item.quantityOnHand,
          newQty,
          reason: reason ?? null,
          referenceId: referenceId ?? null,
          performedById: user.id,
        },
      }),
    ]);

    return NextResponse.json({ item: updated });
  }

  // Field update (admin/manager/advisor only)
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "advisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await db.partInventory.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ item: updated });
}

// DELETE /api/inventory/[id] — soft delete (admin/manager only)
export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; rooftopId?: string };
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const item = await db.partInventory.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.rooftopId !== user.rooftopId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.partInventory.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true });
}
