// [FEATURE: service_reminders]
// Cron endpoint — sends service interval reminders to customers from closed ROs.
// Protected by CRON_SECRET header. Schedule: daily at 10am (set in vercel.json).
// Remove this file and its vercel.json entry to disable.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms/send";
import { buildSmsMessage } from "@/lib/sms/templates";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all rooftops with service reminders enabled
  const rooftops = await prisma.rooftop.findMany({
    where: { serviceRemindersEnabled: true },
    select: { id: true, name: true, reminderLeadDays: true, smsEnabled: true },
  });

  let totalSent = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const rooftop of rooftops) {
    const leadDays = rooftop.reminderLeadDays ?? 30;
    // Target: ROs closed roughly 5 months ago (assuming 6-month service intervals)
    const targetWindowStart = new Date(Date.now() - (180 + leadDays) * 86_400_000);
    const targetWindowEnd = new Date(Date.now() - (180 + leadDays - 7) * 86_400_000);

    const closedROs = await prisma.repairOrder.findMany({
      where: {
        rooftopId: rooftop.id,
        status: "closed",
        closedAt: { gte: targetWindowStart, lte: targetWindowEnd },
        customerPhone: { not: null },
        roType: "customer",
      },
      select: {
        id: true,
        vin: true,
        customerName: true,
        customerPhone: true,
        roNumber: true,
        closedAt: true,
      },
    });

    for (const ro of closedROs) {
      if (!ro.customerPhone) { totalSkipped++; continue; }

      // Skip if this customer already has an open RO at this rooftop
      const openRO = await prisma.repairOrder.findFirst({
        where: {
          rooftopId: rooftop.id,
          customerPhone: ro.customerPhone,
          status: { notIn: ["closed", "cancelled"] },
        },
        select: { id: true },
      });
      if (openRO) { totalSkipped++; continue; }

      // Skip if we already sent a reminder for this RO (check via ROMessage)
      const alreadySent = await prisma.rOMessage.findFirst({
        where: {
          repairOrderId: ro.id,
          category: "external",
          content: { contains: "service reminder" },
        },
      });
      if (alreadySent) { totalSkipped++; continue; }

      if (rooftop.smsEnabled) {
        const message = buildSmsMessage("vehicle_ready", {
          customerName: ro.customerName,
          dealerName: rooftop.name,
        }).replace("your vehicle is ready for pickup", "it's time for your next service");

        const result = await sendSms({ to: ro.customerPhone, message });
        if (result.sent) {
          // Find a system user to attribute the message to (use the first admin at the rooftop)
          const sysUser = await prisma.user.findFirst({
            where: { rooftopId: rooftop.id, role: "admin" },
            select: { id: true },
          });
          if (sysUser) {
            await prisma.rOMessage.create({
              data: {
                repairOrderId: ro.id,
                authorId: sysUser.id,
                content: `[service reminder] SMS sent to ${ro.customerPhone}`,
                category: "external",
              },
            });
          }
          totalSent++;
        } else {
          errors.push(`RO ${ro.id}: ${result.error}`);
          totalSkipped++;
        }
      } else {
        totalSkipped++;
      }
    }
  }

  console.log(`[service-reminders] sent=${totalSent}, skipped=${totalSkipped}, errors=${errors.length}`);
  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, errors });
}
