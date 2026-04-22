// [FEATURE: parts_ordering]
// GET /api/parts-ordering/search?supplier=NAPA&q=oil+filter&partNumber=WIX-123
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flagEnabled } from "@/lib/flags/evaluate";
import { getSupplierAdapter } from "@/lib/parts-ordering/factory";
import { prisma as db } from "@/lib/db";
import type { PartSearchResult } from "@/lib/parts-ordering/adapter";

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

  // Local-first lookup: check PartInventory and PartsCatalog before hitting supplier adapters
  if (user.rooftopId) {
    if (partNumber) {
      // Exact part number match against local inventory
      const invMatches = await db.partInventory.findMany({
        where: { rooftopId: user.rooftopId, partNumber: { equals: partNumber, mode: "insensitive" }, isActive: true },
      });
      if (invMatches.length > 0) {
        const results: PartSearchResult[] = invMatches.map((inv) => ({
          partNumber: inv.partNumber,
          description: inv.description,
          brand: inv.supplier ?? "Inventory",
          unitCost: inv.unitCost,
          availability: (inv.quantityOnHand > 0 ? "in_stock" : "out_of_stock") as PartSearchResult["availability"],
        }));
        return NextResponse.json({ supplier: "inventory", results });
      }
      // Fall back to OEM catalog
      const catMatches = await db.partsCatalog.findMany({
        where: { partNumber: { equals: partNumber, mode: "insensitive" }, isActive: true },
      });
      if (catMatches.length > 0) {
        const results: PartSearchResult[] = catMatches.map((p) => ({
          partNumber: p.partNumber,
          description: p.name + (p.description ? ` — ${p.description}` : ""),
          brand: p.oem,
          unitCost: p.defaultCost,
          availability: "in_stock" as const,
        }));
        return NextResponse.json({ supplier: "catalog", results });
      }
    } else if (q) {
      // Keyword search against local inventory
      const invMatches = await db.partInventory.findMany({
        where: {
          rooftopId: user.rooftopId,
          isActive: true,
          OR: [
            { partNumber: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      });
      if (invMatches.length > 0) {
        const results: PartSearchResult[] = invMatches.map((inv) => ({
          partNumber: inv.partNumber,
          description: inv.description,
          brand: inv.supplier ?? "Inventory",
          unitCost: inv.unitCost,
          availability: (inv.quantityOnHand > 0 ? "in_stock" : "out_of_stock") as PartSearchResult["availability"],
        }));
        return NextResponse.json({ supplier: "inventory", results });
      }
      // Fall back to OEM catalog keyword search
      const catMatches = await db.partsCatalog.findMany({
        where: {
          isActive: true,
          OR: [
            { partNumber: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      });
      if (catMatches.length > 0) {
        const results: PartSearchResult[] = catMatches.map((p) => ({
          partNumber: p.partNumber,
          description: p.name + (p.description ? ` — ${p.description}` : ""),
          brand: p.oem,
          unitCost: p.defaultCost,
          availability: "in_stock" as const,
        }));
        return NextResponse.json({ supplier: "catalog", results });
      }
    }
  }

  // Fall through to supplier adapter — load rooftop's supplier credentials
  const rooftopRow = user.rooftopId
    ? await db.rooftop.findUnique({ where: { id: user.rooftopId }, select: { supplierConfig: true } })
    : null;
  const adapter = getSupplierAdapter(supplier, rooftopRow?.supplierConfig ?? null);
  const results = await adapter.searchParts(q, partNumber);

  return NextResponse.json({ supplier, results });
}
