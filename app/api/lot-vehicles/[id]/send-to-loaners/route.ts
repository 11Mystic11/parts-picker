// POST /api/lot-vehicles/[id]/send-to-loaners
// Promotes a lot vehicle to the loaners fleet by creating a LoanerVehicle entry
// and marking the LotVehicle.isLoaner = true.
// DELETE /api/lot-vehicles/[id]/send-to-loaners
// Recalls the lot vehicle from loaners (isLoaner = false, removes LoanerVehicle if no active loans).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { id } = await params;

  const lotVehicle = await db.lotVehicle.findUnique({ where: { id } });
  if (!lotVehicle || lotVehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lotVehicle.isLoaner) {
    return NextResponse.json({ error: "Already in loaners fleet" }, { status: 409 });
  }

  // Create a corresponding LoanerVehicle entry
  await db.$transaction([
    db.loanerVehicle.create({
      data: {
        rooftopId: user.rooftopId,
        vin: lotVehicle.vin ?? "UNKNOWN",
        make: lotVehicle.make,
        model: lotVehicle.model,
        year: lotVehicle.year ?? new Date().getFullYear(),
        licensePlate: lotVehicle.licensePlate ?? null,
        color: lotVehicle.color ?? null,
        status: "available",
        lotVehicleId: id,
        notes: lotVehicle.notes ?? null,
      },
    }),
    db.lotVehicle.update({
      where: { id },
      data: { isLoaner: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { id } = await params;

  const lotVehicle = await db.lotVehicle.findUnique({ where: { id } });
  if (!lotVehicle || lotVehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find associated loaner vehicle
  const loanerVehicle = await db.loanerVehicle.findFirst({
    where: { lotVehicleId: id, rooftopId: user.rooftopId },
    include: { loans: { where: { checkInAt: null } } },
  });

  if (loanerVehicle && loanerVehicle.loans.length > 0) {
    return NextResponse.json({ error: "Cannot recall: vehicle is currently on loan" }, { status: 409 });
  }

  await db.$transaction([
    // Remove the loaner vehicle entry (if exists)
    ...(loanerVehicle
      ? [db.loanerVehicle.delete({ where: { id: loanerVehicle.id } })]
      : []),
    db.lotVehicle.update({
      where: { id },
      data: { isLoaner: false },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
