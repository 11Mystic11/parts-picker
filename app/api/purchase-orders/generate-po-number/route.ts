// [FEATURE: purchase_orders]
// Atomically generate the next Vendor PO number for this rooftop.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  // Atomically increment the counter and return the formatted number
  const rooftop = await prisma.rooftop.update({
    where: { id: user.rooftopId },
    data: { poNumberNext: { increment: 1 } },
    select: { poNumberPrefix: true, poNumberNext: true, poNumberPadding: true },
  });

  const prefix = rooftop.poNumberPrefix ?? "PO-";
  const padding = rooftop.poNumberPadding ?? 4;
  // poNumberNext was incremented, so we use the value before increment
  const seq = (rooftop.poNumberNext - 1).toString().padStart(padding, "0");
  const poNumber = `${prefix}${seq}`;

  return NextResponse.json({ poNumber });
}
