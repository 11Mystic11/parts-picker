// POST /api/lot-vehicles/import — bulk import lot vehicles
// Body: { csv: string } for manual CSV, or { vehicles: ParsedVehicle[] } for AI-parsed data

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import type { ParsedVehicle } from "./ai-parse/route";

function parseCSV(text: string): ParsedVehicle[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const r = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    return {
      vin: r.vin || null,
      year: r.year ? parseInt(r.year, 10) || null : null,
      make: r.make || "Unknown",
      model: r.model || "Unknown",
      trim: r.trim || null,
      color: r.color || null,
      licensePlate: r.licenseplate || r["license plate"] || r.licenseplate || null,
      stockNumber: r.stocknumber || r["stock number"] || r.stocknumber || null,
      mileage: r.mileage ? parseInt(r.mileage, 10) || null : null,
      notes: r.notes || null,
    };
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  let body: { csv?: string; vehicles?: ParsedVehicle[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let rows: ParsedVehicle[];
  if (Array.isArray(body.vehicles) && body.vehicles.length > 0) {
    rows = body.vehicles;
  } else if (body.csv?.trim()) {
    rows = parseCSV(body.csv);
  } else {
    return NextResponse.json({ error: "CSV data or pre-parsed vehicles required" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const created: string[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.make && !r.model) {
      errors.push({ row: i + 2, error: "make and model are required" });
      continue;
    }
    try {
      const v = await db.lotVehicle.create({
        data: {
          rooftopId: user.rooftopId,
          vin: r.vin || null,
          year: typeof r.year === "number" ? r.year : null,
          make: r.make || "Unknown",
          model: r.model || "Unknown",
          trim: r.trim || null,
          color: r.color || null,
          licensePlate: r.licensePlate || null,
          stockNumber: r.stockNumber || null,
          mileage: typeof r.mileage === "number" ? r.mileage : null,
          notes: r.notes || null,
        },
      });
      created.push(v.id);
    } catch (e: any) {
      errors.push({ row: i + 2, error: e.message ?? "Unknown error" });
    }
  }

  return NextResponse.json({ created: created.length, errors });
}
