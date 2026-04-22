// POST /api/lot-vehicles/import/ai-parse
// Sends raw CSV (any column format) to Claude Haiku, returns structured vehicle array.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface ParsedVehicle {
  vin: string | null;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  color: string | null;
  licensePlate: string | null;
  stockNumber: string | null;
  mileage: number | null;
  notes: string | null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { csv?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.csv?.trim()) {
    return NextResponse.json({ error: "CSV data required" }, { status: 400 });
  }

  const lines = body.csv.trim().split(/\r?\n/);
  const totalRows = lines.length - 1; // exclude header
  // Cap at 150 data rows to stay within token limits
  const preview = lines.slice(0, 151).join("\n");

  let message;
  try {
    message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `You are parsing a dealer vehicle inventory CSV export. The column names may be non-standard — map them intelligently to these fields:

- vin: Vehicle Identification Number (17 chars). May be labeled "VIN", "Vehicle ID", etc.
- year: Model year (integer). May be "Yr", "Year", "Model Year", etc.
- make: Manufacturer. May be "Make", "Mfr", "Brand", etc.
- model: Vehicle model. May be "Model", "Vehicle Model", etc.
- trim: Trim/sub-model. May be "Trim", "Trim Level", "Package", etc. Use null if absent.
- color: Exterior color. May be "Color", "Ext Color", "Exterior", etc. Use null if absent.
- licensePlate: License plate. May be "Plate", "License Plate", "Tag #", etc. Use null if absent.
- stockNumber: Dealer stock number. May be "Stock #", "Stock No", "Stk", "Inv #", etc. Use null if absent.
- mileage: Odometer reading (integer miles). May be "Miles", "Mileage", "Odometer", "KM" (convert if km), etc. Use null if absent.
- notes: Any other columns worth preserving (combine if multiple). Use null if nothing relevant.

Rules:
- Return ONLY a raw JSON array — no markdown, no explanation, no code blocks.
- Each element must have all 10 fields above. Use null for absent/empty values.
- make and model are required; if missing, use "Unknown".
- Numeric fields (year, mileage) must be integers or null, not strings.
- Skip completely empty rows.

CSV data:
${preview}`,
      }],
    });
  } catch (e: any) {
    return NextResponse.json({ error: `AI service error: ${e.message ?? "Unknown"}` }, { status: 502 });
  }

  const raw = (message.content[0] as { type: string; text: string }).text.trim();

  let vehicles: ParsedVehicle[];
  try {
    // Strip markdown code fences if model added them despite instructions
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error("Response was not an array");
    vehicles = parsed;
  } catch {
    return NextResponse.json(
      { error: "AI returned an unexpected format. Try cleaning up the CSV or use manual import." },
      { status: 422 },
    );
  }

  return NextResponse.json({ vehicles, totalRows });
}
