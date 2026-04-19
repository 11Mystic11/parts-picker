// [FEATURE: notifications]
// GET unread notifications for the current user.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      readAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return NextResponse.json({ notifications, unreadCount });
}
