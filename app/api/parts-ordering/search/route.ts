// [FEATURE: parts_ordering]
// GET /api/parts-ordering/search?supplier=NAPA&q=oil+filter&partNumber=WIX-123
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flagEnabled } from "@/lib/flags/evaluate";
import { getSupplierAdapter } from "@/lib/parts-ordering/factory";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };

  const enabled = await flagEnabled("parts_ordering" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const supplier = searchParams.get("supplier") ?? "mock";
  const q = searchParams.get("q") ?? "";
  const partNumber = searchParams.get("partNumber") ?? undefined;

  if (!q && !partNumber) {
    return NextResponse.json({ error: "q or partNumber is required" }, { status: 400 });
  }

  const adapter = getSupplierAdapter(supplier, null);
  const results = await adapter.searchParts(q, partNumber);

  return NextResponse.json({ supplier, results });
}
