// GET /api/inspections/[id]/pdf
// — in_progress: blank printable form (tech fills out on paper)
// — complete:    filled results report

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import {
  generateInspectionPdf,
  generateBlankInspectionPdf,
  type InspectionItem,
} from "@/lib/dvi/inspection-pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const inspection = await db.roInspection.findUnique({
    where: { id },
    include: {
      template: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
      tech: { select: { name: true, rooftopId: true } },
      lotVehicle: { select: { year: true, make: true, model: true } },
      results: {
        include: { templateItem: { select: { label: true, sortOrder: true } } },
        orderBy: { templateItem: { sortOrder: "asc" } },
      },
    },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (inspection.tech.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId! },
    select: { name: true },
  });

  const rooftopName = rooftop?.name ?? "Inspection Report";
  const safeId = id.slice(-8).toUpperCase();

  const vehicleName =
    inspection.vehicleLabel ??
    (inspection.lotVehicle
      ? [inspection.lotVehicle.year, inspection.lotVehicle.make, inspection.lotVehicle.model]
          .filter(Boolean)
          .join(" ")
      : "Unknown Vehicle");

  let pdfBuffer: Buffer;

  if (inspection.status === "in_progress") {
    // Blank printable form
    pdfBuffer = await generateBlankInspectionPdf({
      rooftopName,
      templateName: inspection.template.name,
      vin: inspection.vin ?? "",
      vehicleName,
      techName: inspection.tech.name ?? null,
      date: new Date(),
      items: inspection.template.items.map((item) => ({
        label: item.label,
        checkType: item.checkType,
        unit: item.unit,
      })),
    });
  } else {
    // Filled results report
    const items: InspectionItem[] = inspection.results.map((r) => ({
      label: r.templateItem.label,
      result: r.value ?? "not_inspected",
      notes: r.notes ?? null,
      photoUrls: [],
    }));

    pdfBuffer = await generateInspectionPdf({
      rooftopName,
      roNumber: inspection.template.name,
      vin: inspection.vin ?? "",
      vehicleName,
      techName: inspection.tech.name ?? null,
      completedAt: inspection.updatedAt,
      items,
    });
  }

  const filename =
    inspection.status === "in_progress"
      ? `inspection-form-${safeId}.pdf`
      : `inspection-report-${safeId}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
