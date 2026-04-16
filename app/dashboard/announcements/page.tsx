import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AnnouncementsClient } from "./announcements-client";

export default async function AnnouncementsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const user = session.user as { rooftopId?: string; role?: string };
  if (!user.rooftopId) redirect("/dashboard");

  const announcements = await db.announcement.findMany({
    where: { rooftopId: user.rooftopId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true, role: true } } },
  });

  const canManage = ["admin", "manager"].includes(user.role ?? "");

  return (
    <div className="p-6 max-w-3xl">
      <AnnouncementsClient
        initialAnnouncements={announcements.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          priority: a.priority,
          expiresAt: a.expiresAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          author: { name: a.author.name, role: a.author.role },
        }))}
        canManage={canManage}
      />
    </div>
  );
}
