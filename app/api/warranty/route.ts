// [FEATURE: warranty_claims]
// Warranty Claims — list and create claims.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  repairOrderId: z.string().min(1),
  claimNumber: z.string().max(100).optional().nullable(),
  failureDescription: z.string().min(1).max(2000),
  oemLaborCode: z.string().max(100).optional().nullable(),
  partsUsed: z.string().optional().nullable(), // JSON string
  expectedReimbursement: z.number().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const status = req.nextUrl.searchParams.get("status");

  const claims = await prisma.warrantyClaim.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(status ? { status } : {}),
    },
    include: {
      repairOrder: { select: { roNumber: true, vin: true, customerName: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ claims });
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

  // Verify the RO belongs to this rooftop
  const ro = await prisma.repairOrder.findUnique({
    where: { id: parsed.data.repairOrderId },
    select: { rooftopId: true },
  });
  if (!ro || ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Repair order not found" }, { status: 404 });
  }

  const claim = await prisma.warrantyClaim.create({
    data: {
      rooftopId: user.rooftopId,
      createdById: user.id,
      repairOrderId: parsed.data.repairOrderId,
      claimNumber: parsed.data.claimNumber ?? null,
      failureDescription: parsed.data.failureDescription,
      oemLaborCode: parsed.data.oemLaborCode ?? null,
      partsUsed: parsed.data.partsUsed ?? null,
      expectedReimbursement: parsed.data.expectedReimbursement ?? 0,
    },
  });

  return NextResponse.json({ claim }, { status: 201 });
}
