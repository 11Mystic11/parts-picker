// [FEATURE: notifications]
// PATCH — mark a single notification as read.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string };
  const { id } = await params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
