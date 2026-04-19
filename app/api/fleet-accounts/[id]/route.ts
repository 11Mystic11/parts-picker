// [FEATURE: fleet_accounts]
// GET/PATCH/DELETE a single fleet account.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  contactName: z.string().max(255).optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable(),
  billingCycle: z.enum(["weekly", "monthly"]).optional(),
  requiresPo: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const account = await prisma.fleetAccount.findUnique({
    where: { id },
    include: {
      repairOrders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, roNumber: true, status: true, totalAmount: true, createdAt: true, vin: true, customerName: true },
      },
    },
  });
  if (!account || account.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ account });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const account = await prisma.fleetAccount.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!account || account.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.fleetAccount.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ account: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const account = await prisma.fleetAccount.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!account || account.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete — deactivate rather than hard delete (preserve RO links)
  await prisma.fleetAccount.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
