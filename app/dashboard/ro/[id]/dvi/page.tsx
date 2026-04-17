// [FEATURE: dvi]
// Technician-facing DVI capture page for a specific RO.
// Remove this file to disable.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DVICapture } from "@/components/dvi/dvi-capture";
import { createDefaultDVIReport } from "@/lib/dvi/create-report";

type Props = { params: Promise<{ id: string }> };

export default async function DVIPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      dviReport: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (!ro) notFound();
  if (ro.rooftopId !== user.rooftopId) notFound();

  let report = ro.dviReport;
  if (!report) {
    const reportId = await createDefaultDVIReport(id, user.id, ro.lineItems);
    const fresh = await db.dVIReport.findUnique({
      where: { id: reportId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    report = fresh;
  }

  if (!report) notFound();

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href={`/dashboard/ro/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to RO
      </Link>

      <DVICapture roId={id} initialReport={report} />
    </div>
  );
}
