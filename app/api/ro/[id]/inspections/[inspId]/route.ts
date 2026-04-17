// [FEATURE: canned_inspections]
// PATCH /api/ro/[id]/inspections/[inspId] — update results or mark complete
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

type Params = { params: Promise<{ id: string; inspId: string }> };

const patchSchema = z.object({
  status: z.enum(["in_progress", "complete"]).optional(),
  results: z
    .array(
      z.object({
        templateItemId: z.string(),
        value: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id, inspId } = await params;

  const enabled = await flagEnabled("canned_inspections" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { status, results } = parsed.data;

  // Upsert result rows
  if (results?.length) {
    await Promise.all(
      results.map((r) =>
        db.inspectionResult.upsert({
          where: { inspectionId_templateItemId: { inspectionId: inspId, templateItemId: r.templateItemId } },
          update: {
            value: r.value ?? null,
            notes: r.notes ?? null,
            updatedAt: new Date(),
          },
          create: {
            inspectionId: inspId,
            templateItemId: r.templateItemId,
            value: r.value ?? null,
            notes: r.notes ?? null,
            updatedAt: new Date(),
          },
        })
      )
    );
  }

  if (status) {
    await db.roInspection.update({ where: { id: inspId }, data: { status } });
  }

  const updated = await db.roInspection.findUnique({
    where: { id: inspId },
    include: {
      template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      results: true,
    },
  });

  return NextResponse.json({ inspection: updated });
}
