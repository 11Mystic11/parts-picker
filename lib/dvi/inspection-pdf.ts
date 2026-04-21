// [FEATURE: dvi]
// Generates a customer-facing Vehicle Health Report PDF from DVI inspection data.
// Uses PDFKit (already in serverExternalPackages in next.config.ts).
import PDFDocument from "pdfkit";

export interface InspectionItem {
  label: string;
  result: string; // "ok" | "advisory" | "critical" | "not_inspected"
  notes: string | null;
  photoUrls: string[]; // blob URLs (not embedded — listed below the item)
}

export interface InspectionReportData {
  rooftopName: string;
  roNumber: string;
  vin: string;
  vehicleName: string; // e.g. "2021 Toyota Camry"
  techName: string | null;
  completedAt: Date;
  items: InspectionItem[];
}

const RESULT_COLOR: Record<string, string> = {
  ok: "#16a34a",       // green-600
  advisory: "#d97706", // amber-600
  critical: "#dc2626", // red-600
  not_inspected: "#9ca3af", // gray-400
};

const RESULT_LABEL: Record<string, string> = {
  ok: "OK",
  advisory: "Advisory",
  critical: "Critical",
  not_inspected: "Not Inspected",
};

export interface BlankInspectionData {
  rooftopName: string;
  templateName: string;
  vin: string;
  vehicleName: string;
  techName: string | null;
  date: Date;
  items: { label: string; checkType: string; unit: string | null }[];
}

export async function generateBlankInspectionPdf(data: BlankInspectionData): Promise<Buffer> {
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", resolve);
    doc.on("error", reject);

    const PAGE_W = 612 - 100;
    const dateStr = data.date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#111827").text(data.rooftopName, 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text("Vehicle Inspection Form", 50, 73);

    doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
    doc.text(data.templateName, 400, 50, { align: "right", width: PAGE_W - 350 });
    doc.text(dateStr, 400, 64, { align: "right", width: PAGE_W - 350 });
    if (data.techName) {
      doc.text(`Tech: ${data.techName}`, 400, 78, { align: "right", width: PAGE_W - 350 });
    }

    doc.moveTo(50, 98).lineTo(562, 98).strokeColor("#e5e7eb").lineWidth(1).stroke();

    // ── Vehicle info ─────────────────────────────────────────────────────────
    let y = 112;
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text(data.vehicleName, 50, y);
    y += 18;
    if (data.vin) {
      doc.fontSize(9).font("Helvetica").fillColor("#9ca3af").text(`VIN: ${data.vin}`, 50, y);
      y += 14;
    }

    // ── Editable fields row ──────────────────────────────────────────────────
    y += 6;
    doc.fontSize(8).font("Helvetica").fillColor("#374151");
    // Mileage in
    doc.text("Mileage In:", 50, y);
    doc.moveTo(110, y + 10).lineTo(210, y + 10).strokeColor("#9ca3af").lineWidth(0.75).stroke();
    // Tech signature
    doc.text("Tech:", 230, y);
    doc.moveTo(260, y + 10).lineTo(380, y + 10).strokeColor("#9ca3af").lineWidth(0.75).stroke();
    // Date
    doc.text("Date:", 400, y);
    doc.moveTo(425, y + 10).lineTo(512, y + 10).strokeColor("#9ca3af").lineWidth(0.75).stroke();
    y += 24;

    doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 12;

    // ── Legend for condition checks ──────────────────────────────────────────
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#374151").text("CONDITION KEY:", 50, y, { continued: true });
    doc.font("Helvetica").fillColor("#16a34a").text("  ○ OK", { continued: true });
    doc.fillColor("#d97706").text("  ○ Advisory", { continued: true });
    doc.fillColor("#dc2626").text("  ○ Critical");
    y += 16;

    doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 10;

    // ── Inspection items ─────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text("INSPECTION ITEMS", 50, y);
    y += 14;

    for (const item of data.items) {
      if (y > 690) {
        doc.addPage();
        y = 50;
      }

      // Item label
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#111827").text(item.label, 50, y, { width: 300 });

      const labelH = doc.heightOfString(item.label, { width: 300 });

      if (item.checkType === "condition") {
        // Three empty circles: OK / Advisory / Critical
        const circleY = y + (labelH / 2) - 4;
        const opts = [
          { label: "OK", color: "#16a34a" },
          { label: "Advisory", color: "#d97706" },
          { label: "Critical", color: "#dc2626" },
        ];
        let cx = 360;
        for (const opt of opts) {
          doc.circle(cx, circleY + 4, 5).strokeColor(opt.color).lineWidth(1).stroke();
          doc.fontSize(7.5).font("Helvetica").fillColor(opt.color).text(opt.label, cx + 8, circleY + 0.5);
          cx += 58;
        }
      } else if (item.checkType === "passfail") {
        const circleY = y + (labelH / 2) - 4;
        doc.circle(360, circleY + 4, 5).strokeColor("#16a34a").lineWidth(1).stroke();
        doc.fontSize(7.5).font("Helvetica").fillColor("#16a34a").text("Pass", 371, circleY + 0.5);
        doc.circle(420, circleY + 4, 5).strokeColor("#dc2626").lineWidth(1).stroke();
        doc.fontSize(7.5).font("Helvetica").fillColor("#dc2626").text("Fail", 431, circleY + 0.5);
      } else if (item.checkType === "measurement") {
        const lineY = y + (labelH / 2) + 2;
        doc.moveTo(360, lineY).lineTo(500, lineY).strokeColor("#9ca3af").lineWidth(0.75).stroke();
        if (item.unit) {
          doc.fontSize(7.5).font("Helvetica").fillColor("#9ca3af").text(item.unit, 504, lineY - 8);
        }
      }

      y += Math.max(labelH, 14) + 4;

      // Notes line
      doc.fontSize(7).font("Helvetica").fillColor("#9ca3af").text("Notes:", 50, y);
      doc.moveTo(82, y + 9).lineTo(562, y + 9).strokeColor("#d1d5db").lineWidth(0.5).stroke();
      y += 20;

      doc.moveTo(50, y).lineTo(562, y).strokeColor("#f3f4f6").lineWidth(0.5).stroke();
      y += 8;
    }

    // ── Footer signature block ────────────────────────────────────────────────
    if (y > 680) { doc.addPage(); y = 50; }
    y += 16;
    doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 16;

    doc.fontSize(8).font("Helvetica").fillColor("#374151");
    doc.text("Advisor Signature:", 50, y);
    doc.moveTo(145, y + 12).lineTo(310, y + 12).strokeColor("#9ca3af").lineWidth(0.75).stroke();
    doc.text("Date:", 330, y);
    doc.moveTo(355, y + 12).lineTo(460, y + 12).strokeColor("#9ca3af").lineWidth(0.75).stroke();

    // Page footer
    doc.fontSize(7).font("Helvetica").fillColor("#9ca3af")
      .text(
        `${data.templateName}  ·  ${data.rooftopName}  ·  Printed ${new Date().toLocaleDateString()}`,
        50, 730, { align: "center", width: PAGE_W }
      );

    doc.end();
  });

  return Buffer.concat(chunks);
}

export async function generateInspectionPdf(data: InspectionReportData): Promise<Buffer> {
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", resolve);
    doc.on("error", reject);

    const PAGE_W = 612 - 100;
    const dateStr = data.completedAt.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#111827").text(data.rooftopName, 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text("Vehicle Health Report", 50, 73);

    doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
    doc.text(data.roNumber, 400, 50, { align: "right", width: PAGE_W - 350 });
    doc.text(dateStr, 400, 64, { align: "right", width: PAGE_W - 350 });
    if (data.techName) {
      doc.text(`Tech: ${data.techName}`, 400, 78, { align: "right", width: PAGE_W - 350 });
    }

    doc.moveTo(50, 98).lineTo(562, 98).strokeColor("#e5e7eb").lineWidth(1).stroke();

    // ── Vehicle info ─────────────────────────────────────────────────────────
    let y = 112;
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text(data.vehicleName, 50, y);
    y += 18;
    doc.fontSize(9).font("Helvetica").fillColor("#9ca3af").text(`VIN: ${data.vin}`, 50, y);
    y += 22;

    doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 14;

    // ── Legend ───────────────────────────────────────────────────────────────
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#374151").text("LEGEND", 50, y);
    y += 10;
    for (const [result, color] of Object.entries(RESULT_COLOR)) {
      if (result === "not_inspected") continue;
      doc.circle(56, y + 4, 4).fillColor(color).fill();
      doc.font("Helvetica").fillColor("#374151").text(RESULT_LABEL[result], 66, y, { continued: true });
      doc.fillColor("#374151").text("  ", { continued: false });
      y += 13;
    }
    y += 8;

    doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 14;

    // ── Inspection items ─────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text("INSPECTION RESULTS", 50, y);
    y += 14;

    // Group by result severity: critical first, then advisory, then ok, then not_inspected
    const ORDER = ["critical", "advisory", "ok", "not_inspected"];
    const sorted = [...data.items].sort(
      (a, b) => ORDER.indexOf(a.result) - ORDER.indexOf(b.result)
    );

    for (const item of sorted) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const color = RESULT_COLOR[item.result] ?? "#9ca3af";
      const label = RESULT_LABEL[item.result] ?? item.result;

      // Colored dot
      doc.circle(58, y + 5, 5).fillColor(color).fill();

      // Item label
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text(item.label, 72, y, { width: 360 });

      // Result label
      doc.font("Helvetica").fontSize(8).fillColor(color)
        .text(label, 440, y, { align: "right", width: 122 });

      y += 15;

      if (item.notes) {
        doc.font("Helvetica").fontSize(8).fillColor("#6b7280")
          .text(item.notes, 72, y, { width: 490 });
        const textHeight = doc.heightOfString(item.notes, { width: 490 });
        y += textHeight + 4;
      }

      if (item.photoUrls.length > 0) {
        doc.font("Helvetica").fontSize(7.5).fillColor("#9ca3af")
          .text(`${item.photoUrls.length} photo${item.photoUrls.length > 1 ? "s" : ""} on file`, 72, y);
        y += 12;
      }

      y += 4;
      doc.moveTo(72, y).lineTo(562, y).strokeColor("#f3f4f6").lineWidth(0.5).stroke();
      y += 8;
    }

    // ── Summary footer ────────────────────────────────────────────────────────
    const criticalCount = data.items.filter((i) => i.result === "critical").length;
    const advisoryCount = data.items.filter((i) => i.result === "advisory").length;

    if (y > 680) { doc.addPage(); y = 50; }

    y += 10;
    doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 12;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151").text("SUMMARY", 50, y);
    y += 14;

    if (criticalCount > 0) {
      doc.font("Helvetica").fontSize(9).fillColor("#dc2626")
        .text(`${criticalCount} critical item${criticalCount > 1 ? "s" : ""} require immediate attention.`, 50, y);
      y += 14;
    }
    if (advisoryCount > 0) {
      doc.font("Helvetica").fontSize(9).fillColor("#d97706")
        .text(`${advisoryCount} advisory item${advisoryCount > 1 ? "s" : ""} recommended for service soon.`, 50, y);
      y += 14;
    }
    if (criticalCount === 0 && advisoryCount === 0) {
      doc.font("Helvetica").fontSize(9).fillColor("#16a34a")
        .text("All inspected items are in good condition.", 50, y);
    }

    // Page footer
    doc.fontSize(7).font("Helvetica").fillColor("#9ca3af")
      .text(
        `${data.roNumber}  ·  ${data.rooftopName}  ·  Generated ${new Date().toLocaleDateString()}`,
        50, 730, { align: "center", width: PAGE_W }
      );

    doc.end();
  });

  return Buffer.concat(chunks);
}
