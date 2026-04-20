// POST /api/customers/import — bulk import customers from CSV
// CSV columns: name,phone,email,notes

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  let body: { csv?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.csv?.trim()) {
    return NextResponse.json({ error: "CSV data required" }, { status: 400 });
  }

  const rows = parseCSV(body.csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows parsed from CSV" }, { status: 400 });
  }

  const created: string[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.name) {
      errors.push({ row: i + 2, error: "name is required" });
      continue;
    }
    try {
      const c = await db.customer.create({
        data: {
          rooftopId: user.rooftopId,
          name: r.name,
          phone: r.phone || null,
          email: r.email || null,
          notes: r.notes || null,
        },
      });
      created.push(c.id);
    } catch (e: any) {
      errors.push({ row: i + 2, error: e.message ?? "Unknown error" });
    }
  }

  return NextResponse.json({ created: created.length, errors });
}
