// GET    /api/inspections/[id] — get inspection detail
// PATCH  /api/inspections/[id] — update results or status
// DELETE /api/inspections/[id] — delete inspection

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

async function getInspectionScoped(inspId: string, rooftopId?: string) {
  const insp = await db.roInspection.findUnique({
    where: { id: inspId },
    include: {
      template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      results: { include: { templateItem: { select: { label: true, checkType: true, unit: true } } } },
      repairOrder: { select: { id: true, roNumber: true, rooftopId: true } },
      tech: { select: { id: true, name: true, rooftopId: true } },
      lotVehicle: { select: { id: true, year: true, make: true, model: true, stockNumber: true } },
    },
  });
  if (!insp) return null;
  // Scope check: must belong to this rooftop via RO or tech
  const scopeRooftop = insp.repairOrder?.rooftopId ?? insp.tech?.rooftopId;
  if (scopeRooftop !== rooftopId) return null;
  return insp;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const insp = await getInspectionScoped(id, user.rooftopId);
  if (!insp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ inspection: insp });
}

const patchSchema = z.object({
  status: z.enum(["in_progress", "complete"]).optional(),
  vin: z.string().optional().nullable(),
  vehicleLabel: z.string().optional().nullable(),
  results: z.array(z.object({
    templateItemId: z.string(),
    value: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const insp = await getInspectionScoped(id, user.rooftopId);
  if (!insp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { status, vin, vehicleLabel, results } = parsed.data;

  if (results?.length) {
    await Promise.all(
      results.map((r) =>
        db.inspectionResult.upsert({
          where: { inspectionId_templateItemId: { inspectionId: id, templateItemId: r.templateItemId } },
          update: { value: r.value ?? null, notes: r.notes ?? null, updatedAt: new Date() },
          create: {
            inspectionId: id,
            templateItemId: r.templateItemId,
            value: r.value ?? null,
            notes: r.notes ?? null,
            updatedAt: new Date(),
          },
        })
      )
    );
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (vin !== undefined) updateData.vin = vin;
  if (vehicleLabel !== undefined) updateData.vehicleLabel = vehicleLabel;

  if (Object.keys(updateData).length > 0) {
    await db.roInspection.update({ where: { id }, data: updateData });
  }

  const updated = await getInspectionScoped(id, user.rooftopId);
  return NextResponse.json({ inspection: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; rooftopId?: string };
  const { id } = await params;

  const insp = await getInspectionScoped(id, user.rooftopId);
  if (!insp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.roInspection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
