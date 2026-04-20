// [FEATURE: core_return_tracking]
// GET  /api/part-returns — list returns for the rooftop (filterable by status/returnType/supplier)
// POST /api/part-returns — create a new return record
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

const createSchema = z.object({
  repairOrderId: z.string().optional().nullable(),
  lineItemId: z.string().optional().nullable(),
  partNumber: z.string().min(1),
  description: z.string().min(1),
  supplier: z.string().min(1),
  returnType: z.enum(["core", "warranty"]),
  quantity: z.number().positive().default(1),
  expectedCredit: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };

  const enabled = await flagEnabled("core_return_tracking" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const returnType = searchParams.get("returnType");
  const supplier = searchParams.get("supplier");

  const returns = await db.partReturn.findMany({
    where: {
      rooftopId: user.rooftopId!,
      ...(status ? { status } : {}),
      ...(returnType ? { returnType } : {}),
      ...(supplier ? { supplier: { contains: supplier } } : {}),
    },
    include: {
      repairOrder: { select: { roNumber: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ returns });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };

  const enabled = await flagEnabled("core_return_tracking" as any, user.rooftopId);
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

  const partReturn = await db.partReturn.create({
    data: {
      rooftopId: user.rooftopId!,
      repairOrderId: parsed.data.repairOrderId ?? null,
      lineItemId: parsed.data.lineItemId ?? null,
      partNumber: parsed.data.partNumber,
      description: parsed.data.description,
      supplier: parsed.data.supplier,
      returnType: parsed.data.returnType,
      quantity: parsed.data.quantity,
      expectedCredit: parsed.data.expectedCredit,
      notes: parsed.data.notes ?? null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ partReturn }, { status: 201 });
}
