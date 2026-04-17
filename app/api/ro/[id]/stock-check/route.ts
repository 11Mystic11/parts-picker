// [FEATURE: inventory_ro_integration]
// GET /api/ro/[id]/stock-check — pre-flight inventory check before presenting an RO.
// Returns stock status for all part line items that have an inventory record.
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { checkStockForRO } from "@/lib/inventory/ro-integration";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({
    where: { id },
    select: { rooftopId: true },
  });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await checkStockForRO(id, ro.rooftopId);
  return NextResponse.json({ stockCheck: results });
}
