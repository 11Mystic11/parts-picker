// [FEATURE: special_orders]
// Special Order Parts (SOP) — list and create customer-specific ordered parts.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  partNumber: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  supplier: z.string().min(1).max(100),
  quantity: z.number().positive().optional(),
  customerName: z.string().min(1).max(255),
  customerPhone: z.string().max(20).optional().nullable(),
  depositCollected: z.number().min(0).optional(),
  vendorPO: z.string().max(100).optional().nullable(),
  supplierEta: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  repairOrderId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const status = req.nextUrl.searchParams.get("status");

  const sops = await prisma.specialOrderPart.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(status ? { status } : { status: { not: "cancelled" } }),
    },
    include: {
      createdBy: { select: { name: true } },
      repairOrder: { select: { id: true, roNumber: true, customerName: true, customerPhone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ sops });
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

  const sop = await prisma.specialOrderPart.create({
    data: {
      rooftopId: user.rooftopId,
      createdById: user.id,
      partNumber: parsed.data.partNumber,
      description: parsed.data.description,
      supplier: parsed.data.supplier,
      quantity: parsed.data.quantity ?? 1,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone ?? null,
      depositCollected: parsed.data.depositCollected ?? 0,
      vendorPO: parsed.data.vendorPO ?? null,
      supplierEta: parsed.data.supplierEta ? new Date(parsed.data.supplierEta) : null,
      notes: parsed.data.notes ?? null,
      repairOrderId: parsed.data.repairOrderId ?? null,
    },
  });

  return NextResponse.json({ sop }, { status: 201 });
}
