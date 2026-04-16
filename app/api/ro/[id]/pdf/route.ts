import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import PDFDocument from "pdfkit";

type Params = { params: Promise<{ id: string }> };

// GET /api/ro/[id]/pdf — generate and stream a PDF for the RO
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      advisor: { select: { name: true, employeeId: true } },
      rooftop: { select: { name: true, laborRate: true } },
    },
  });

  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let vehicle: { year?: number; make?: string; model?: string; vin?: string; engine?: string; drivetrain?: string } = {};
  try {
    vehicle = JSON.parse(ro.vehicleSnapshot);
  } catch { /* use empty */ }

  const pdfBuffer = await generateROPdf(ro, vehicle);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="RO-${id.slice(-8).toUpperCase()}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}

async function generateROPdf(
  ro: {
    id: string;
    status: string;
    vin: string;
    currentMileage: number | null;
    partsSubtotal: number;
    laborSubtotal: number;
    shopSupplyFee: number;
    taxAmount: number;
    totalAmount: number;
    notes: string | null;
    createdAt: Date;
    presentedAt: Date | null;
    lineItems: Array<{
      type: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      partNumber: string | null;
      laborOpCode: string | null;
    }>;
    advisor: { name: string | null; employeeId: string | null };
    rooftop: { name: string; laborRate: number };
  },
  vehicle: { year?: number; make?: string; model?: string; vin?: string; engine?: string; drivetrain?: string }
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", resolve);
    doc.on("error", reject);

    const pageWidth = 612 - 100; // LETTER width minus margins
    const roNumber = `RO-${ro.id.slice(-8).toUpperCase()}`;
    const dateStr = ro.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#111827").text(ro.rooftop.name, 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text("Repair Order", 50, 76);

    // RO meta (right side)
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#111827");
    doc.text(roNumber, 400, 50, { align: "right", width: pageWidth - 350 });
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
    doc.text(`Date: ${dateStr}`, 400, 66, { align: "right", width: pageWidth - 350 });
    doc.text(`Status: ${ro.status.toUpperCase()}`, 400, 80, { align: "right", width: pageWidth - 350 });
    if (ro.advisor.name) {
      const advisorLabel = ro.advisor.employeeId
        ? `Advisor: ${ro.advisor.name} (${ro.advisor.employeeId})`
        : `Advisor: ${ro.advisor.name}`;
      doc.text(advisorLabel, 400, 94, { align: "right", width: pageWidth - 350 });
    }

    // Divider
    doc.moveTo(50, 115).lineTo(562, 115).strokeColor("#e5e7eb").lineWidth(1).stroke();

    // ── Vehicle Info ─────────────────────────────────────────────────────────
    let y = 128;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text("VEHICLE", 50, y);
    doc.font("Helvetica").fillColor("#111827");
    const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
    doc.fontSize(11).text(vehicleName || "Unknown Vehicle", 50, y + 14);
    doc.fontSize(9).fillColor("#6b7280");

    const vehicleDetails = [
      vehicle.engine,
      vehicle.drivetrain,
      `${(ro.currentMileage ?? 0).toLocaleString()} miles`,
    ].filter(Boolean).join("  ·  ");
    doc.text(vehicleDetails, 50, y + 30);

    doc.fontSize(9).font("Helvetica").fillColor("#9ca3af").text(`VIN: ${ro.vin}`, 50, y + 44);

    doc.moveTo(50, y + 60).lineTo(562, y + 60).strokeColor("#e5e7eb").stroke();
    y += 73;

    // ── Parts Table ──────────────────────────────────────────────────────────
    const parts = ro.lineItems.filter((li) => li.type === "part");
    if (parts.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text("PARTS", 50, y);
      y += 14;

      // Table header
      doc.fontSize(8).fillColor("#6b7280");
      doc.text("Description", 50, y, { width: 280 });
      doc.text("Qty", 340, y, { width: 50, align: "right" });
      doc.text("Unit Price", 400, y, { width: 70, align: "right" });
      doc.text("Total", 480, y, { width: 82, align: "right" });
      y += 12;
      doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").stroke();
      y += 6;

      doc.font("Helvetica").fillColor("#111827").fontSize(8.5);
      for (const item of parts) {
        const desc = item.partNumber ? `${item.description.split(" — ")[0]}\n#${item.partNumber}` : item.description;
        const lines = item.partNumber ? 2 : 1;
        doc.text(desc, 50, y, { width: 280 });
        doc.text(String(item.quantity), 340, y, { width: 50, align: "right" });
        doc.text(`$${item.unitPrice.toFixed(2)}`, 400, y, { width: 70, align: "right" });
        doc.text(`$${item.totalPrice.toFixed(2)}`, 480, y, { width: 82, align: "right" });
        y += lines * 12 + 4;
      }

      // Parts subtotal
      doc.moveTo(350, y).lineTo(562, y).strokeColor("#e5e7eb").stroke();
      y += 6;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#374151");
      doc.text("Parts Subtotal", 380, y, { width: 90, align: "right" });
      doc.text(`$${ro.partsSubtotal.toFixed(2)}`, 480, y, { width: 82, align: "right" });
      y += 20;
    }

    // ── Labor Table ──────────────────────────────────────────────────────────
    const labor = ro.lineItems.filter((li) => li.type === "labor");
    if (labor.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text("LABOR", 50, y);
      y += 14;

      doc.fontSize(8).fillColor("#6b7280");
      doc.text("Operation", 50, y, { width: 280 });
      doc.text("Hours", 340, y, { width: 50, align: "right" });
      doc.text("Rate", 400, y, { width: 70, align: "right" });
      doc.text("Total", 480, y, { width: 82, align: "right" });
      y += 12;
      doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").stroke();
      y += 6;

      doc.font("Helvetica").fillColor("#111827").fontSize(8.5);
      for (const item of labor) {
        doc.text(item.description, 50, y, { width: 280 });
        doc.text(item.quantity.toFixed(1), 340, y, { width: 50, align: "right" });
        doc.text(`$${item.unitPrice.toFixed(2)}/hr`, 400, y, { width: 70, align: "right" });
        doc.text(`$${item.totalPrice.toFixed(2)}`, 480, y, { width: 82, align: "right" });
        y += 16;
      }

      doc.moveTo(350, y).lineTo(562, y).strokeColor("#e5e7eb").stroke();
      y += 6;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#374151");
      doc.text("Labor Subtotal", 380, y, { width: 90, align: "right" });
      doc.text(`$${ro.laborSubtotal.toFixed(2)}`, 480, y, { width: 82, align: "right" });
      y += 20;
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    doc.moveTo(350, y).lineTo(562, y).strokeColor("#d1d5db").lineWidth(0.5).stroke();
    y += 8;

    doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280");
    doc.text("Parts", 380, y, { width: 90, align: "right" });
    doc.text(`$${ro.partsSubtotal.toFixed(2)}`, 480, y, { width: 82, align: "right" });
    y += 14;
    doc.text("Labor", 380, y, { width: 90, align: "right" });
    doc.text(`$${ro.laborSubtotal.toFixed(2)}`, 480, y, { width: 82, align: "right" });
    y += 14;

    if (ro.shopSupplyFee > 0) {
      doc.text("Shop Supply", 380, y, { width: 90, align: "right" });
      doc.text(`$${ro.shopSupplyFee.toFixed(2)}`, 480, y, { width: 82, align: "right" });
      y += 14;
    }
    if (ro.taxAmount > 0) {
      doc.text("Tax", 380, y, { width: 90, align: "right" });
      doc.text(`$${ro.taxAmount.toFixed(2)}`, 480, y, { width: 82, align: "right" });
      y += 14;
    }

    doc.moveTo(350, y).lineTo(562, y).strokeColor("#374151").lineWidth(1).stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827");
    doc.text("TOTAL", 380, y, { width: 90, align: "right" });
    doc.text(`$${ro.totalAmount.toFixed(2)}`, 480, y, { width: 82, align: "right" });

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (ro.notes) {
      y += 30;
      doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      y += 10;
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#374151").text("NOTES", 50, y);
      y += 12;
      doc.font("Helvetica").fillColor("#6b7280").text(ro.notes, 50, y, { width: 462 });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica").fillColor("#9ca3af")
      .text(`${roNumber}  ·  Generated ${new Date().toLocaleDateString()}`, 50, 730, {
        align: "center",
        width: pageWidth,
      });

    doc.end();
  });

  return Buffer.concat(chunks);
}
