// [FEATURE: loaner_vehicles]
// GET /api/loaners/[id]/pdf — generate a loaner agreement PDF for a LoanerVehicle.
// If the vehicle has an active loan, includes that loan's customer info.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import PDFDocument from "pdfkit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const vehicle = await db.loanerVehicle.findUnique({
    where: { id },
    include: {
      rooftop: { select: { name: true } },
      loans: {
        where: { checkInAt: null },
        orderBy: { checkOutAt: "desc" },
        take: 1,
        include: {
          repairOrder: { select: { roNumber: true } },
        },
      },
    },
  });

  if (!vehicle || vehicle.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activeLoan = vehicle.loans[0] ?? null;
  const pdfBuffer = await generateLoanerPdf(vehicle, activeLoan);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Loaner-Agreement-${id.slice(-6).toUpperCase()}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}

type LoanerVehicleData = {
  id: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string | null;
  color: string | null;
  rooftop: { name: string };
};

type LoanData = {
  customerName: string;
  customerPhone: string | null;
  checkOutAt: Date;
  expectedReturnAt: Date | null;
  mileageOut: number;
  fuelLevelOut: number;
  notes: string | null;
  repairOrder: { roNumber: string | null } | null;
} | null;

async function generateLoanerPdf(vehicle: LoanerVehicleData, loan: LoanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PRI = "#1a56db";
    const GRAY = "#6b7280";
    const BORDER = "#e5e7eb";
    const pageWidth = doc.page.width - 100;

    // Header
    doc.fillColor(PRI).rect(50, 50, pageWidth, 4).fill();
    doc.moveDown(0.5);
    doc.fillColor("#111827").fontSize(20).font("Helvetica-Bold")
      .text("LOANER VEHICLE AGREEMENT", 50, 65, { align: "center", width: pageWidth });

    doc.fontSize(10).fillColor(GRAY).font("Helvetica")
      .text(vehicle.rooftop.name, 50, 92, { align: "center", width: pageWidth });

    doc.moveDown(1.5);

    // --- Vehicle Info ---
    sectionHeader(doc, "Vehicle Information", PRI, pageWidth);
    row(doc, "Year / Make / Model", `${vehicle.year} ${vehicle.make} ${vehicle.model}`, GRAY, pageWidth);
    row(doc, "VIN", vehicle.vin, GRAY, pageWidth);
    if (vehicle.licensePlate) row(doc, "License Plate", vehicle.licensePlate, GRAY, pageWidth);
    if (vehicle.color) row(doc, "Color", vehicle.color, GRAY, pageWidth);
    doc.moveDown(0.5);

    // --- Customer / Loan Info ---
    sectionHeader(doc, "Customer Information", PRI, pageWidth);
    if (loan) {
      row(doc, "Customer Name", loan.customerName, GRAY, pageWidth);
      if (loan.customerPhone) row(doc, "Customer Phone", loan.customerPhone, GRAY, pageWidth);
      if (loan.repairOrder?.roNumber) row(doc, "Associated RO", loan.repairOrder.roNumber, GRAY, pageWidth);
      row(doc, "Check-Out Date", loan.checkOutAt.toLocaleDateString(), GRAY, pageWidth);
      if (loan.expectedReturnAt) {
        row(doc, "Expected Return", loan.expectedReturnAt.toLocaleDateString(), GRAY, pageWidth);
      }
      row(doc, "Mileage Out", String(loan.mileageOut), GRAY, pageWidth);
      row(doc, "Fuel Level Out", `${loan.fuelLevelOut}%`, GRAY, pageWidth);
      if (loan.notes) row(doc, "Notes", loan.notes, GRAY, pageWidth);
    } else {
      doc.fillColor(GRAY).fontSize(10).text("No active loan at time of printing.", 50, undefined, { width: pageWidth });
    }
    doc.moveDown(1);

    // --- Terms ---
    sectionHeader(doc, "Terms & Conditions", PRI, pageWidth);
    const terms = [
      "The borrower agrees to return the vehicle in the same condition as received.",
      "Any damage to the loaner vehicle not attributable to normal wear and tear is the borrower's responsibility.",
      "The vehicle must be returned with the same fuel level as when received.",
      "Traffic violations incurred during the loan period are the borrower's sole responsibility.",
      "The dealership reserves the right to recall the vehicle at any time.",
    ];
    doc.fontSize(9).fillColor("#374151").font("Helvetica");
    terms.forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, 50, undefined, { width: pageWidth });
      doc.moveDown(0.3);
    });
    doc.moveDown(1);

    // --- Signature Lines ---
    sectionHeader(doc, "Signatures", PRI, pageWidth);
    const sigY = doc.y;
    const halfW = (pageWidth - 30) / 2;

    // Customer signature
    doc.fillColor(BORDER).rect(50, sigY + 35, halfW, 1).fill();
    doc.fillColor(GRAY).fontSize(9).text("Customer Signature", 50, sigY + 40, { width: halfW, align: "center" });
    doc.fillColor(BORDER).rect(50, sigY + 60, halfW / 2, 1).fill();
    doc.fillColor(GRAY).text("Date", 50, sigY + 65, { width: halfW / 2, align: "center" });

    // Dealership signature
    doc.fillColor(BORDER).rect(50 + halfW + 30, sigY + 35, halfW, 1).fill();
    doc.fillColor(GRAY).fontSize(9).text("Dealership Representative", 50 + halfW + 30, sigY + 40, { width: halfW, align: "center" });
    doc.fillColor(BORDER).rect(50 + halfW + 30, sigY + 60, halfW / 2, 1).fill();
    doc.fillColor(GRAY).text("Date", 50 + halfW + 30, sigY + 65, { width: halfW / 2, align: "center" });

    // Footer
    doc.fillColor(PRI).rect(50, doc.page.height - 60, pageWidth, 1).fill();
    doc.fillColor(GRAY).fontSize(8)
      .text(`Generated ${new Date().toLocaleString()} · ${vehicle.rooftop.name}`, 50, doc.page.height - 50, {
        align: "center",
        width: pageWidth,
      });

    doc.end();
  });
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string, color: string, width: number) {
  doc.fillColor(color).fontSize(11).font("Helvetica-Bold")
    .text(text.toUpperCase(), 50, undefined, { width });
  doc.fillColor("#e5e7eb").rect(50, doc.y, width, 1).fill();
  doc.moveDown(0.4);
}

function row(doc: PDFKit.PDFDocument, label: string, value: string, grayColor: string, width: number) {
  const y = doc.y;
  doc.fillColor(grayColor).fontSize(9).font("Helvetica").text(label, 50, y, { width: 140 });
  doc.fillColor("#111827").fontSize(9).font("Helvetica").text(value, 200, y, { width: width - 150 });
  doc.moveDown(0.3);
}
