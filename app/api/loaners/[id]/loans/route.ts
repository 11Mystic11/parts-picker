// [FEATURE: loaner_vehicles]
// GET loan history / POST check-out a loaner.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const checkoutSchema = z.object({
  repairOrderId: z.string().min(1),
  customerName: z.string().min(1).max(255),
  customerPhone: z.string().max(20).optional().nullable(),
  expectedReturnAt: z.string().datetime().optional().nullable(),
  fuelLevelOut: z.number().int().min(0).max(100).optional(),
  mileageOut: z.number().int().min(0),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const vehicle = await prisma.loanerVehicle.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!vehicle || vehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loans = await prisma.loanerLoan.findMany({
    where: { loanerVehicleId: id },
    include: {
      repairOrder: { select: { roNumber: true, vin: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { checkOutAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ loans });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const vehicle = await prisma.loanerVehicle.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!vehicle || vehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (vehicle.status !== "available") {
    return NextResponse.json({ error: "Vehicle is not available for checkout" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const loan = await prisma.$transaction(async (tx) => {
    const l = await tx.loanerLoan.create({
      data: {
        loanerVehicleId: id,
        repairOrderId: parsed.data.repairOrderId,
        customerName: parsed.data.customerName,
        customerPhone: parsed.data.customerPhone ?? null,
        expectedReturnAt: parsed.data.expectedReturnAt ? new Date(parsed.data.expectedReturnAt) : null,
        fuelLevelOut: parsed.data.fuelLevelOut ?? 100,
        mileageOut: parsed.data.mileageOut,
        notes: parsed.data.notes ?? null,
        createdById: user.id,
      },
    });
    await tx.loanerVehicle.update({ where: { id }, data: { status: "loaned" } });
    return l;
  });

  return NextResponse.json({ loan }, { status: 201 });
}
