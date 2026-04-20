// [FEATURE: customer_approval_portal]
// POST /api/ro/[id]/approval-token — create/refresh a customer approval token for this RO
// and optionally fire SMS + email. Guarded by the customer_approval_portal feature flag.
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { sendApprovalLink } from "@/lib/approval/send-link";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  // Feature flag guard
  const enabled = await flagEnabled("customer_approval_portal" as any, user.rooftopId);
  if (!enabled) {
    return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });
  }

  const ro = await db.repairOrder.findUnique({
    where: { id },
    select: {
      id: true,
      rooftopId: true,
      status: true,
      roNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
    },
  });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ro.status !== "presented") {
    return NextResponse.json(
      { error: "Approval links can only be sent for presented ROs" },
      { status: 400 }
    );
  }

  // Upsert token — always regenerate to reset expiry
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
  const existing = await db.rOApprovalToken.findUnique({
    where: { repairOrderId: id },
  });

  let token: string;
  if (existing) {
    const updated = await db.rOApprovalToken.update({
      where: { repairOrderId: id },
      data: { token: crypto.randomUUID(), expiresAt, usedAt: null },
    });
    token = updated.token;
  } else {
    const created = await db.rOApprovalToken.create({
      data: { repairOrderId: id, expiresAt },
    });
    token = created.token;
  }

  // Parse body for optional send flags
  let sendSms = true;
  let sendEmail = true;
  try {
    const body = await req.json();
    if (body.sendSms !== undefined) sendSms = Boolean(body.sendSms);
    if (body.sendEmail !== undefined) sendEmail = Boolean(body.sendEmail);
  } catch {
    // body is optional
  }

  const baseUrl = req.nextUrl.origin;

  // Temporarily mask phone/email if caller opted out
  const roForSend = {
    ...ro,
    customerPhone: sendSms ? ro.customerPhone : null,
    customerEmail: sendEmail ? ro.customerEmail : null,
  };

  const sendResult = await sendApprovalLink(roForSend, token, baseUrl);

  return NextResponse.json({
    token,
    approvalUrl: `${baseUrl}/portal/${token}`,
    expiresAt: expiresAt.toISOString(),
    ...sendResult,
  });
}
