// [FEATURE: purchase_orders]
// Purchase Orders — list and create POs for inventory replenishment.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const lineSchema = z.object({
  partNumber: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  qtyOrdered: z.number().positive(),
  unitCost: z.number().min(0),
  inventoryId: z.string().optional().nullable(),
});

const createSchema = z.object({
  supplier: z.string().min(1).max(100),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const status = req.nextUrl.searchParams.get("status");

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(status ? { status } : {}),
    },
    include: {
      createdBy: { select: { name: true } },
      lines: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const order = await prisma.purchaseOrder.create({
    data: {
      rooftopId: user.rooftopId,
      createdById: user.id,
      supplier: parsed.data.supplier,
      notes: parsed.data.notes ?? null,
      lines: {
        create: parsed.data.lines.map((l) => ({
          partNumber: l.partNumber,
          description: l.description,
          qtyOrdered: l.qtyOrdered,
          unitCost: l.unitCost,
          inventoryId: l.inventoryId ?? null,
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
