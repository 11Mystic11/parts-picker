// POST /api/lot-vehicles/import/ai-parse
// Sends raw CSV (any column format) to OpenAI, returns structured vehicle array.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";

const client = new OpenAI();

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

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a vehicle data parser. Given a dealer inventory CSV export with non-standard column names, map each row to a JSON object with exactly these fields:
- vin: Vehicle Identification Number (17 chars, string or null)
- year: Model year (integer or null)
- make: Manufacturer string (required, use "Unknown" if missing)
- model: Vehicle model string (required, use "Unknown" if missing)
- trim: Trim level string or null
- color: Exterior color string or null
- licensePlate: License plate string or null
- stockNumber: Dealer stock number string or null
- mileage: Odometer reading integer or null (convert KM to miles if needed)
- notes: Combined value of any other relevant columns, or null

Return a JSON object with a single key "vehicles" containing an array of these objects. Numeric fields must be integers or null. Skip completely empty rows.`,
        },
        {
          role: "user",
          content: `Parse this CSV:\n\n${preview}`,
        },
      ],
    });
  } catch (e: any) {
    return NextResponse.json({ error: `AI service error: ${e.message ?? "Unknown"}` }, { status: 502 });
  }

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  let vehicles: ParsedVehicle[];
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed?.vehicles ?? parsed?.data);
    if (!Array.isArray(arr)) throw new Error("Response was not an array");
    vehicles = arr;
  } catch {
    return NextResponse.json(
      { error: "AI returned an unexpected format. Try cleaning up the CSV or use manual import." },
      { status: 422 },
    );
  }

  return NextResponse.json({ vehicles, totalRows });
}
