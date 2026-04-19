// [FEATURE: loaner_vehicles]
// PATCH — check in a loaner (set checkInAt, fuel/mileage in, update vehicle status).
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string; loanId: string }> };

const checkinSchema = z.object({
  fuelLevelIn: z.number().int().min(0).max(100),
  mileageIn: z.number().int().min(0),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id, loanId } = await params;

  const vehicle = await prisma.loanerVehicle.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!vehicle || vehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loan = await prisma.loanerLoan.findUnique({ where: { id: loanId } });
  if (!loan || loan.loanerVehicleId !== id || loan.checkInAt !== null) {
    return NextResponse.json({ error: "Loan not found or already checked in" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const l = await tx.loanerLoan.update({
      where: { id: loanId },
      data: {
        checkInAt: new Date(),
        fuelLevelIn: parsed.data.fuelLevelIn,
        mileageIn: parsed.data.mileageIn,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : loan.notes,
      },
    });
    await tx.loanerVehicle.update({ where: { id }, data: { status: "available" } });
    return l;
  });

  return NextResponse.json({ loan: updated });
}
