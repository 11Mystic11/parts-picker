import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const user = session.user as { role: string; rooftopId?: string };
  if (user.role === "technician") redirect("/dashboard/tech");

  // Fetch the rooftop timezone
  let timezone = "America/Chicago";
  if (user.rooftopId) {
    const rooftop = await prisma.rooftop.findUnique({
      where: { id: user.rooftopId },
      select: { timezone: true },
    });
    if (rooftop?.timezone) timezone = rooftop.timezone;
  }

  return <CalendarClient timezone={timezone} />;
}
