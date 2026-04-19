import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  partDescription: z.string().min(1).max(255),
  partNumber: z.string().max(50).optional().nullable(),
  quantity: z.number().int().min(1).max(999).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const updateSchema = z.object({
  status: z.enum(["pending", "ordered", "received", "cancelled"]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id: roId } = await params;

  const ro = await prisma.repairOrder.findUnique({
    where: { id: roId },
    select: { rooftopId: true },
  });
  if (!ro || ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requests = await prisma.partRequest.findMany({
    where: { repairOrderId: roId },
    include: { requestedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string; role?: string };
  const { id: roId } = await params;

  const ro = await prisma.repairOrder.findUnique({
    where: { id: roId },
    select: { rooftopId: true },
  });
  if (!ro || ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const request = await prisma.partRequest.create({
    data: {
      repairOrderId: roId,
      rooftopId: user.rooftopId!,
      requestedById: user.id,
      partDescription: parsed.data.partDescription,
      partNumber: parsed.data.partNumber ?? null,
      quantity: parsed.data.quantity ?? 1,
      notes: parsed.data.notes ?? null,
    },
    include: { requestedBy: { select: { name: true } } },
  });

  return NextResponse.json({ request }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string; role?: string };
  // Only advisors/admin/manager can update status
  if (user.role === "technician") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: roId } = await params;
  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  const existing = await prisma.partRequest.findUnique({
    where: { id: requestId },
    select: { repairOrderId: true, rooftopId: true },
  });
  if (!existing || existing.repairOrderId !== roId || existing.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.partRequest.update({
    where: { id: requestId },
    data: { status: parsed.data.status },
    include: { requestedBy: { select: { name: true } } },
  });

  return NextResponse.json({ request: updated });
}
