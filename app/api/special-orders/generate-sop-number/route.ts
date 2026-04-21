// [FEATURE: special_orders]
// Atomically generate the next vendor SOP/PO number for this rooftop.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const rooftop = await prisma.rooftop.update({
    where: { id: user.rooftopId },
    data: { sopNumberNext: { increment: 1 } },
    select: { sopNumberPrefix: true, sopNumberNext: true, sopNumberPadding: true },
  });

  const prefix = rooftop.sopNumberPrefix ?? "SOP-";
  const padding = rooftop.sopNumberPadding ?? 4;
  const seq = (rooftop.sopNumberNext - 1).toString().padStart(padding, "0");
  const sopNumber = `${prefix}${seq}`;

  return NextResponse.json({ sopNumber });
}
