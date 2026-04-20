// GET    /api/lot-vehicles/[id] — get single lot vehicle with RO history
// PATCH  /api/lot-vehicles/[id] — update lot vehicle
// DELETE /api/lot-vehicles/[id] — delete lot vehicle

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  vin: z.string().optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  trim: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  licensePlate: z.string().optional().nullable(),
  stockNumber: z.string().optional().nullable(),
  mileage: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["available", "in_service", "sold"]).optional(),
});

async function getVehicle(id: string, rooftopId: string) {
  const v = await db.lotVehicle.findUnique({ where: { id } });
  if (!v || v.rooftopId !== rooftopId) return null;
  return v;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const vehicle = await db.lotVehicle.findUnique({
    where: { id },
    include: {
      repairOrders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, roNumber: true, status: true, createdAt: true, scheduledAt: true,
          advisor: { select: { name: true } },
        },
      },
    },
  });

  if (!vehicle || vehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ vehicle });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  if (!user.rooftopId || !await getVehicle(id, user.rooftopId)) {
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

  const updated = await db.lotVehicle.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ vehicle: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  if (!user.rooftopId || !await getVehicle(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.lotVehicle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
