// [FEATURE: warranty_claims]
// GET/PATCH/DELETE a single warranty claim.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["draft", "submitted", "approved", "paid", "rejected"]).optional(),
  claimNumber: z.string().max(100).optional().nullable(),
  oemLaborCode: z.string().max(100).optional().nullable(),
  partsUsed: z.string().optional().nullable(),
  expectedReimbursement: z.number().min(0).optional(),
  actualReimbursement: z.number().min(0).optional().nullable(),
  rejectionReason: z.string().max(1000).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const claim = await prisma.warrantyClaim.findUnique({
    where: { id },
    include: {
      repairOrder: { select: { roNumber: true, vin: true, customerName: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!claim || claim.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ claim });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const claim = await prisma.warrantyClaim.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!claim || claim.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const now = new Date();
  const data: Record<string, unknown> = {};

  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "submitted") data.submittedAt = now;
    if (parsed.data.status === "approved") data.approvedAt = now;
    if (parsed.data.status === "paid") data.paidAt = now;
  }
  if (parsed.data.claimNumber !== undefined) data.claimNumber = parsed.data.claimNumber;
  if (parsed.data.oemLaborCode !== undefined) data.oemLaborCode = parsed.data.oemLaborCode;
  if (parsed.data.partsUsed !== undefined) data.partsUsed = parsed.data.partsUsed;
  if (parsed.data.expectedReimbursement !== undefined) data.expectedReimbursement = parsed.data.expectedReimbursement;
  if (parsed.data.actualReimbursement !== undefined) data.actualReimbursement = parsed.data.actualReimbursement;
  if (parsed.data.rejectionReason !== undefined) data.rejectionReason = parsed.data.rejectionReason;

  const updated = await prisma.warrantyClaim.update({ where: { id }, data });
  return NextResponse.json({ claim: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const claim = await prisma.warrantyClaim.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!claim || claim.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (claim.status !== "draft") {
    return NextResponse.json({ error: "Can only delete draft claims" }, { status: 400 });
  }

  await prisma.warrantyClaim.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
