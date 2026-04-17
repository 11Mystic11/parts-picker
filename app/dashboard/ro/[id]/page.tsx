import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RODetailClient } from "./ro-detail-client";
import { ROScheduleForm } from "./ro-schedule-form";
// [FEATURE: dvi] START
import { DVISummary } from "@/components/dvi/dvi-summary";
// [FEATURE: dvi] END
// [FEATURE: canned_inspections] START
import { InspectionSummary } from "@/components/inspections/inspection-summary";
// [FEATURE: canned_inspections] END

type Props = { params: Promise<{ id: string }> };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface text-muted-foreground",
  presented: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  approved: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  closed: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  void: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

export default async function RODetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const user = session.user as { rooftopId?: string; role?: string };
  const { id } = await params;

  const [ro, techs] = await Promise.all([
    db.repairOrder.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        advisor: { select: { name: true, email: true } },
        assignedTech: { select: { id: true, name: true } },
        overrides: {
          orderBy: { createdAt: "desc" },
          include: { advisor: { select: { name: true } } },
          take: 20,
        },
        // [FEATURE: dvi] START
        dviReport: {
          include: {
            items: { orderBy: { sortOrder: "asc" } },
          },
        },
        // [FEATURE: dvi] END
        // [FEATURE: canned_inspections] START
        inspections: {
          include: {
            template: { select: { name: true, items: true } },
            results: { include: { templateItem: { select: { label: true, checkType: true, unit: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
        // [FEATURE: canned_inspections] END
      },
    }),
    // Load techs in this rooftop for assignment dropdown
    db.user.findMany({
      where: { rooftopId: user.rooftopId, role: "technician" },
      select: { id: true, name: true, employeeId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!ro) notFound();
  if (ro.rooftopId !== user.rooftopId) notFound();

  let vehicle: { year?: number; make?: string; model?: string; engine?: string; drivetrain?: string; trim?: string; vin?: string } = {};
  try { vehicle = JSON.parse(ro.vehicleSnapshot); } catch { /* use empty */ }

  const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const roNumber = ro.roNumber ?? `RO-${ro.id.slice(-8).toUpperCase()}`;

  return (
    <div className="p-6 max-w-4xl">
      {/* Back nav */}
      <Link
        href="/dashboard/ro"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5"
      >
        <ChevronLeft className="h-4 w-4" />
        Repair Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-foreground font-mono">{roNumber}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[ro.status] ?? "bg-surface text-foreground"}`}
            >
              {ro.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {ro.createdAt.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
            {ro.advisor.name && ` · ${ro.advisor.name}`}
          </p>
        </div>
      </div>

      {/* Vehicle card */}
      <div className="flex items-start gap-4 p-4 glass border border-border/50 rounded-lg mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Car className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">
            {vehicleName || "Unknown Vehicle"}
            {vehicle.trim && <span className="font-normal text-muted-foreground"> — {vehicle.trim}</span>}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {[vehicle.engine, vehicle.drivetrain].filter(Boolean).join(" / ")}
            {ro.currentMileage != null && ` · ${ro.currentMileage.toLocaleString()} miles`}
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">{ro.vin}</p>
        </div>
      </div>

      {/* Scheduling panel — visible to advisor/manager/admin */}
      {user.role !== "technician" && (
        <ROScheduleForm
          roId={ro.id}
          scheduledAt={ro.scheduledAt?.toISOString() ?? null}
          estimatedDuration={ro.estimatedDuration ?? null}
          assignedTechId={ro.assignedTechId ?? null}
          customerName={ro.customerName ?? null}
          customerPhone={ro.customerPhone ?? null}
          customerEmail={ro.customerEmail ?? null}
          techs={techs}
        />
      )}

      {/* Line items + actions (client component) */}
      <RODetailClient
        roId={ro.id}
        status={ro.status}
        lineItems={ro.lineItems.map((li) => ({
          id: li.id,
          type: li.type,
          source: li.source,
          description: li.description,
          quantity: li.quantity,
          unitCost: li.unitCost,
          unitPrice: li.unitPrice,
          totalPrice: li.totalPrice,
          partNumber: li.partNumber,
          laborOpCode: li.laborOpCode,
          supplier: li.supplier,
          isAccepted: li.isAccepted,
        }))}
        partsSubtotal={ro.partsSubtotal}
        laborSubtotal={ro.laborSubtotal}
        shopSupplyFee={ro.shopSupplyFee}
        taxAmount={ro.taxAmount}
        totalAmount={ro.totalAmount}
        notes={ro.notes}
        dmsSyncStatus={ro.dmsSyncStatus}
        dmsSyncedAt={ro.dmsSyncedAt?.toISOString() ?? null}
        dmsExternalId={ro.dmsExternalId}
      />

      {/* [FEATURE: dvi] START */}
      {ro.dviReport && (
        <div className="mt-6">
          <DVISummary report={ro.dviReport as any} />
        </div>
      )}
      {/* [FEATURE: dvi] END */}

      {/* [FEATURE: canned_inspections] START */}
      {ro.inspections && ro.inspections.length > 0 && (
        <div className="mt-6 space-y-4">
          <InspectionSummary inspections={ro.inspections} />
        </div>
      )}
      {/* [FEATURE: canned_inspections] END */}

      {/* Override audit trail */}
      {ro.overrides.length > 0 && (
        <div className="mt-8 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-surface border-b border-border">
            <span className="text-sm font-semibold text-muted-foreground">Override History</span>
          </div>
          <div className="divide-y divide-border">
            {ro.overrides.map((ov) => (
              <div key={ov.id} className="px-4 py-3 text-xs text-muted-foreground flex items-start gap-3">
                <div className="flex-1">
                  <span className="font-medium text-foreground">{ov.advisor.name ?? "Advisor"}</span>
                  {" changed "}
                  <span className="font-mono text-foreground">{ov.field}</span>
                  {" from "}
                  <span className="font-mono line-through text-muted-foreground">{ov.oldValue}</span>
                  {" to "}
                  <span className="font-mono font-medium text-foreground">{ov.newValue}</span>
                  {ov.reason && <span className="text-muted-foreground"> — {ov.reason}</span>}
                </div>
                <time className="text-muted-foreground flex-shrink-0">
                  {ov.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
