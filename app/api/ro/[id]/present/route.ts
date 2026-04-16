import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// POST /api/ro/[id]/present — transition RO to "presented" status
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({ where: { id } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ro.status !== "draft") {
    return NextResponse.json({ error: `RO is already ${ro.status}` }, { status: 400 });
  }

  const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const result = await tx.repairOrder.update({
      where: { id },
      data: { status: "presented", presentedAt: new Date(), wizardStep: 5 },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        rooftopId: user.rooftopId!,
        repairOrderId: id,
        action: "ro.presented",
        entityType: "RepairOrder",
        entityId: id,
      },
    });

    return result;
  });

  return NextResponse.json({ ro: { id: updated.id, status: updated.status, presentedAt: updated.presentedAt } });
}
