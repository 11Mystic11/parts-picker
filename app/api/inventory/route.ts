import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

const CATEGORIES = ["Filters", "Fluids", "Brakes", "Batteries", "Belts", "Ignition", "Wipers", "Other"] as const;

const createSchema = z.object({
  partNumber: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(CATEGORIES).default("Other"),
  supplier: z.string().optional(),
  unitCost: z.number().min(0).default(0),
  unitPrice: z.number().min(0).default(0),
  quantityOnHand: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(5),
  reorderQty: z.number().min(0).default(10),
  location: z.string().optional(),
});

// GET /api/inventory — list inventory for current rooftop
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search")?.trim();

  const items = await db.partInventory.findMany({
    where: {
      rooftopId: user.rooftopId,
      isActive: true,
      ...(category && category !== "All" ? { category } : {}),
      ...(search
        ? {
            OR: [
              { partNumber: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { supplier: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
  });

  return NextResponse.json({ items });
}

// POST /api/inventory — create inventory item (manager/admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "advisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Check for duplicate part number
  const existing = await db.partInventory.findUnique({
    where: { rooftopId_partNumber: { rooftopId: user.rooftopId, partNumber: parsed.data.partNumber } },
  });
  if (existing) {
    return NextResponse.json({ error: `Part number ${parsed.data.partNumber} already exists in inventory` }, { status: 409 });
  }

  const item = await db.partInventory.create({
    data: {
      rooftopId: user.rooftopId,
      ...parsed.data,
    },
  });

  // Record initial receive movement if starting qty > 0
  if (parsed.data.quantityOnHand > 0) {
    await db.inventoryMovement.create({
      data: {
        inventoryId: item.id,
        type: "receive",
        quantity: parsed.data.quantityOnHand,
        previousQty: 0,
        newQty: parsed.data.quantityOnHand,
        reason: "Initial stock",
        performedById: user.id,
      },
    });
  }

  return NextResponse.json({ item }, { status: 201 });
}
