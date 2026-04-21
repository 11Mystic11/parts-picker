// PATCH  /api/customers/[id]/vehicles/[vehicleId] — update a customer vehicle
// DELETE /api/customers/[id]/vehicles/[vehicleId] — remove a customer vehicle

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string; vehicleId: string }> };

const updateSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  vin: z.string().optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  trim: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  licensePlate: z.string().optional().nullable(),
  mileage: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function getVehicle(vehicleId: string, customerId: string, rooftopId: string) {
  const v = await db.customerVehicle.findUnique({ where: { id: vehicleId } });
  return v?.customerId === customerId && v?.rooftopId === rooftopId ? v : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { id, vehicleId } = await params;
  if (!await getVehicle(vehicleId, id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const updated = await db.customerVehicle.update({
    where: { id: vehicleId },
    data: parsed.data,
  });

  return NextResponse.json({ vehicle: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { id, vehicleId } = await params;
  if (!await getVehicle(vehicleId, id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.customerVehicle.delete({ where: { id: vehicleId } });
  return NextResponse.json({ ok: true });
}
