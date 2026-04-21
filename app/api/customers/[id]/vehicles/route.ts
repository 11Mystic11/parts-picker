// GET  /api/customers/[id]/vehicles — list vehicles for a customer
// POST /api/customers/[id]/vehicles — add a vehicle to a customer

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  vin: z.string().optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  trim: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  licensePlate: z.string().optional().nullable(),
  mileage: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function getCustomer(id: string, rooftopId: string) {
  const c = await db.customer.findUnique({ where: { id }, select: { id: true, rooftopId: true } });
  return c?.rooftopId === rooftopId ? c : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { id } = await params;
  if (!await getCustomer(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const vehicles = await db.customerVehicle.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ vehicles });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { id } = await params;
  if (!await getCustomer(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const vehicle = await db.customerVehicle.create({
      data: {
        customerId: id,
        rooftopId: user.rooftopId,
        ...parsed.data,
      },
    });
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/customers/[id]/vehicles]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
