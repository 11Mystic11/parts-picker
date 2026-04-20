// [FEATURE: canned_inspections]
// GET  /api/inspection-templates — list templates for this rooftop + system-wide
// POST /api/inspection-templates — create a new template (admin/manager only)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

const itemSchema = z.object({
  label: z.string().min(1),
  checkType: z.enum(["condition", "passfail", "measurement"]).default("condition"),
  unit: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  triggerMileage: z.number().int().positive().optional().nullable(),
  triggerWindow: z.number().int().positive().optional().nullable(),
  isGlobal: z.boolean().default(false),
  items: z.array(itemSchema).default([]),
});

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };

  const templates = await db.inspectionTemplate.findMany({
    where: {
      isActive: true,
      OR: [{ rooftopId: user.rooftopId }, { rooftopId: null }],
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };

  if (!["admin", "manager", "developer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enabled = await flagEnabled("canned_inspections" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { name, description, triggerMileage, triggerWindow, isGlobal, items } = parsed.data;

  const template = await db.inspectionTemplate.create({
    data: {
      rooftopId: isGlobal ? null : user.rooftopId,
      name,
      description: description ?? null,
      triggerMileage: triggerMileage ?? null,
      triggerWindow: triggerWindow ?? 2500,
      items: {
        create: items.map((item) => ({
          label: item.label,
          checkType: item.checkType,
          unit: item.unit ?? null,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({ template }, { status: 201 });
}
