// [FEATURE: loaner_vehicles]
// Loaner vehicle fleet — list and add vehicles.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  vin: z.string().min(1).max(17),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
  licensePlate: z.string().max(20).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const vehicles = await prisma.loanerVehicle.findMany({
    where: { rooftopId: user.rooftopId },
    include: {
      loans: {
        where: { checkInAt: null },
        include: { repairOrder: { select: { roNumber: true } } },
        take: 1,
        orderBy: { checkOutAt: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ vehicles });
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

  const vehicle = await prisma.loanerVehicle.create({
    data: {
      rooftopId: user.rooftopId,
      vin: parsed.data.vin,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      licensePlate: parsed.data.licensePlate ?? null,
      color: parsed.data.color ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ vehicle }, { status: 201 });
}
