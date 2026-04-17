// [FEATURE: customer_approval_portal]
// POST /api/portal/[token]/decide — public endpoint (no auth required).
// Customer submits approve/decline decisions for individual RO line items.
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ token: string }> };

const decideSchema = z.object({
  customerName: z.string().optional(),
  decisions: z
    .array(
      z.object({
        lineItemId: z.string(),
        decision: z.enum(["approved", "declined"]),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const record = await db.rOApprovalToken.findUnique({
    where: { token },
    include: { repairOrder: { select: { id: true, lineItems: { select: { id: true } } } } },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This approval link has expired" }, { status: 410 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { customerName, decisions } = parsed.data;
  const roId = record.repairOrder.id;
  const validLineItemIds = new Set(record.repairOrder.lineItems.map((li) => li.id));

  // Upsert decisions — only for line items that belong to this RO
  await Promise.all(
    decisions
      .filter((d) => validLineItemIds.has(d.lineItemId))
      .map((d) =>
        db.rOLineItemDecision.upsert({
          where: { lineItemId: d.lineItemId },
          update: { decision: d.decision, customerName: customerName ?? null, decidedAt: new Date() },
          create: {
            repairOrderId: roId,
            lineItemId: d.lineItemId,
            decision: d.decision,
            customerName: customerName ?? null,
          },
        })
      )
  );

  // Mark token as used (first submission)
  if (!record.usedAt) {
    await db.rOApprovalToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true, saved: decisions.length });
}
