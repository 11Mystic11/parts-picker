/**
 * app/api/admin/suppliers/route.ts
 *
 * GET   /api/admin/suppliers — returns which suppliers have credentials configured (masked).
 * PATCH /api/admin/suppliers — save credentials for one supplier. Admin only.
 * DELETE /api/admin/suppliers?supplier=X — clear credentials for one supplier.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { encryptConfig, decryptConfig } from "@/lib/dms/adapter";
import { z } from "zod";

const ADMIN_ROLES = ["admin", "developer"];

type SupplierKey = "napa" | "autozone" | "orielly" | "worldpac" | "partstech";

function maskValue(val: string): string {
  if (!val) return "";
  if (val.length <= 4) return "****";
  return val.slice(0, 4) + "****";
}

function maskConfig(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, maskValue(v)]));
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!ADMIN_ROLES.includes(user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId },
    select: { supplierConfig: true },
  });

  if (!rooftop) return NextResponse.json({ error: "Rooftop not found" }, { status: 404 });

  let config: Record<string, Record<string, string>> = {};
  if (rooftop.supplierConfig) {
    const raw = decryptConfig<Record<string, Record<string, string>>>(rooftop.supplierConfig);
    if (raw) {
      // Return masked values per supplier
      config = Object.fromEntries(
        Object.entries(raw).map(([supplier, creds]) => [supplier, maskConfig(creds as Record<string, string>)])
      );
    }
  }

  return NextResponse.json({ suppliers: config });
}

// ─── PATCH — save one supplier's credentials ──────────────────────────────────

const patchSchema = z.object({
  supplier: z.enum(["napa", "autozone", "orielly", "worldpac", "partstech"]),
  credentials: z.record(z.string()),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!ADMIN_ROLES.includes(user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { supplier, credentials } = parsed.data;

  // Load existing config, merge supplier, re-encrypt
  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId },
    select: { supplierConfig: true },
  });

  let existing: Record<string, Record<string, string>> = {};
  if (rooftop?.supplierConfig) {
    existing = decryptConfig<Record<string, Record<string, string>>>(rooftop.supplierConfig) ?? {};
  }

  existing[supplier] = credentials;
  const encrypted = encryptConfig(existing);

  await db.rooftop.update({
    where: { id: user.rooftopId },
    data: { supplierConfig: encrypted },
  });

  return NextResponse.json({ ok: true, supplier });
}

// ─── DELETE — clear one supplier's credentials ────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!ADMIN_ROLES.includes(user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supplier = new URL(req.url).searchParams.get("supplier") as SupplierKey | null;
  if (!supplier) return NextResponse.json({ error: "supplier param required" }, { status: 400 });

  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId },
    select: { supplierConfig: true },
  });

  let existing: Record<string, Record<string, string>> = {};
  if (rooftop?.supplierConfig) {
    existing = decryptConfig<Record<string, Record<string, string>>>(rooftop.supplierConfig) ?? {};
  }

  delete existing[supplier];

  const encrypted = Object.keys(existing).length > 0 ? encryptConfig(existing) : null;
  await db.rooftop.update({ where: { id: user.rooftopId }, data: { supplierConfig: encrypted } });

  return NextResponse.json({ ok: true });
}
