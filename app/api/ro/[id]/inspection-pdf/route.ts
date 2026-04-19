// [FEATURE: dvi]
// GET /api/ro/[id]/inspection-pdf — generates and streams the Vehicle Health Report PDF.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { generateInspectionPdf, type InspectionItem } from "@/lib/dvi/inspection-pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      rooftop: { select: { name: true } },
      dviReport: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!ro || ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ro.dviReport) {
    return NextResponse.json({ error: "No DVI report found for this RO" }, { status: 404 });
  }

  let vehicle: { year?: number; make?: string; model?: string } = {};
  try { vehicle = JSON.parse(ro.vehicleSnapshot); } catch { /* empty */ }

  const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown Vehicle";
  const roNumber = ro.roNumber ?? `RO-${id.slice(-8).toUpperCase()}`;

  const items: InspectionItem[] = ro.dviReport.items.map((item) => {
    let photoUrls: string[] = [];
    try { photoUrls = JSON.parse(item.photoUrls ?? "[]"); } catch { /* */ }

    return {
      label: item.label,
      result: item.condition ?? "not_inspected",
      notes: item.notes ?? null,
      photoUrls,
    };
  });

  const pdfBuffer = await generateInspectionPdf({
    rooftopName: ro.rooftop.name,
    roNumber,
    vin: ro.vin,
    vehicleName,
    techName: null, // could resolve from createdBy if needed
    completedAt: ro.dviReport.updatedAt ?? new Date(),
    items,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inspection-${id.slice(-8).toUpperCase()}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
