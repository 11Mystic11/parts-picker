// GET  /api/inspections — list standalone inspections for this rooftop
// POST /api/inspections — create a standalone inspection (no RO required)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  templateId: z.string().min(1),
  vin: z.string().optional().nullable(),
  vehicleLabel: z.string().optional().nullable(),
  lotVehicleId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string; role?: string };
  const { searchParams } = new URL(req.url);
  const rooftopId = user.rooftopId;
  const statusFilter = searchParams.get("status");

  // Build query: standalone (repairOrderId = null) OR RO-linked, all in this rooftop
  const inspections = await db.roInspection.findMany({
    where: {
      // Scoped to rooftop via tech or RO
      OR: [
        {
          repairOrder: { rooftopId },
        },
        {
          repairOrderId: null,
          tech: { rooftopId },
        },
      ],
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      template: { select: { id: true, name: true } },
      repairOrder: { select: { id: true, roNumber: true } },
      tech: { select: { id: true, name: true } },
      lotVehicle: { select: { id: true, year: true, make: true, model: true, stockNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ inspections });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { templateId, vin, vehicleLabel, lotVehicleId } = parsed.data;

  const template = await db.inspectionTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Verify lot vehicle belongs to this rooftop if specified
  if (lotVehicleId) {
    const lv = await db.lotVehicle.findUnique({ where: { id: lotVehicleId }, select: { rooftopId: true } });
    if (!lv || lv.rooftopId !== user.rooftopId) {
      return NextResponse.json({ error: "Lot vehicle not found" }, { status: 404 });
    }
  }

  const inspection = await db.roInspection.create({
    data: {
      repairOrderId: null,
      templateId,
      techId: user.id,
      vin: vin ?? null,
      vehicleLabel: vehicleLabel ?? null,
      lotVehicleId: lotVehicleId ?? null,
      results: {
        create: template.items.map((item) => ({
          templateItemId: item.id,
          value: null,
          notes: null,
          updatedAt: new Date(),
        })),
      },
    },
    include: {
      template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      results: true,
    },
  });

  return NextResponse.json({ inspection }, { status: 201 });
}
