// [FEATURE: special_orders]
// GET/PATCH/DELETE a single Special Order Part.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendSms } from "@/lib/sms/send";
import { buildSmsMessage } from "@/lib/sms/templates";

type Params = { params: Promise<{ id: string }> };

const STATUS_NEXT: Record<string, string | null> = {
  ordered: "received",
  received: "customer_notified",
  customer_notified: "picked_up",
  picked_up: null,
  cancelled: null,
};

const patchSchema = z.object({
  status: z.enum(["ordered", "received", "customer_notified", "picked_up", "cancelled"]).optional(),
  vendorPO: z.string().max(100).optional().nullable(),
  supplierEta: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  depositCollected: z.number().min(0).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const sop = await prisma.specialOrderPart.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, repairOrder: { select: { roNumber: true } } },
  });
  if (!sop || sop.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ sop });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const sop = await prisma.specialOrderPart.findUnique({
    where: { id },
    select: { rooftopId: true, status: true, customerPhone: true, customerName: true, description: true, createdById: true },
  });
  if (!sop || sop.rooftopId !== user.rooftopId) {
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
    if (parsed.data.status === "received") data.arrivedAt = now;
    if (parsed.data.status === "customer_notified") data.notifiedAt = now;
    if (parsed.data.status === "picked_up") data.pickedUpAt = now;
    if (parsed.data.status === "cancelled") data.cancelledAt = now;
  }
  if (parsed.data.vendorPO !== undefined) data.vendorPO = parsed.data.vendorPO;
  if (parsed.data.supplierEta !== undefined) {
    data.supplierEta = parsed.data.supplierEta ? new Date(parsed.data.supplierEta) : null;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.depositCollected !== undefined) data.depositCollected = parsed.data.depositCollected;

  const updated = await prisma.specialOrderPart.update({ where: { id }, data });

  // Send SMS when customer is notified that their part arrived
  if (parsed.data.status === "customer_notified" && sop.customerPhone) {
    const rooftop = await prisma.rooftop.findUnique({
      where: { id: user.rooftopId! },
      select: { name: true, smsEnabled: true },
    });
    if (rooftop?.smsEnabled) {
      const message = buildSmsMessage("sop_arrived", {
        customerName: sop.customerName,
        partDescription: sop.description,
        dealerName: rooftop.name,
      });
      // Fire-and-forget — don't block response on SMS
      sendSms({ to: sop.customerPhone, message }).catch(() => {});
    }
  }

  return NextResponse.json({ sop: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const sop = await prisma.specialOrderPart.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!sop || sop.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!["ordered", "cancelled"].includes(sop.status)) {
    return NextResponse.json({ error: "Can only delete ordered or cancelled SOPs" }, { status: 400 });
  }

  await prisma.specialOrderPart.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
