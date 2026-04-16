/**
 * app/api/admin/dms/route.ts
 *
 * GET  /api/admin/dms  — returns current DMS config (provider + masked creds).
 * PATCH /api/admin/dms — update dmsProvider + dmsConfig. Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { encryptConfig, decryptConfig } from "@/lib/dms/adapter";
import { z } from "zod";

const ADMIN_ROLES = ["admin", "developer"];

// ─── GET — current DMS config with masked credentials ─────────────────────────

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!ADMIN_ROLES.includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId },
    select: { dmsProvider: true, dmsConfig: true },
  });

  if (!rooftop) return NextResponse.json({ error: "Rooftop not found" }, { status: 404 });

  // Mask sensitive credential values (show first 4 chars + ***)
  let maskedConfig: Record<string, string> | null = null;
  if (rooftop.dmsConfig) {
    const raw = decryptConfig<Record<string, string>>(rooftop.dmsConfig);
    if (raw) {
      maskedConfig = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, maskValue(String(v))])
      );
    }
  }

  return NextResponse.json({
    dmsProvider: rooftop.dmsProvider ?? null,
    hasConfig: !!rooftop.dmsConfig,
    maskedConfig,
  });
}

function maskValue(val: string): string {
  if (val.length <= 4) return "****";
  return val.slice(0, 4) + "****";
}

// ─── PATCH — save DMS config ──────────────────────────────────────────────────

const cdkSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  dealerNumber: z.string().min(1),
});

const reynoldsSchema = z.object({
  apiKey: z.string().min(1),
  dealerCode: z.string().min(1),
});

const patchSchema = z.discriminatedUnion("dmsProvider", [
  z.object({ dmsProvider: z.literal("cdk"), ...cdkSchema.shape }),
  z.object({ dmsProvider: z.literal("reynolds"), ...reynoldsSchema.shape }),
  z.object({ dmsProvider: z.literal("none") }),
]);

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!ADMIN_ROLES.includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.dmsProvider === "none") {
    await db.rooftop.update({
      where: { id: user.rooftopId },
      data: { dmsProvider: null, dmsConfig: null },
    });
    return NextResponse.json({ ok: true, dmsProvider: null });
  }

  // Build config object to encrypt
  let configPayload: Record<string, string>;
  if (data.dmsProvider === "cdk") {
    configPayload = {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      dealerNumber: data.dealerNumber,
    };
  } else {
    configPayload = {
      apiKey: data.apiKey,
      dealerCode: data.dealerCode,
    };
  }

  const encrypted = encryptConfig(configPayload);

  await db.rooftop.update({
    where: { id: user.rooftopId },
    data: { dmsProvider: data.dmsProvider, dmsConfig: encrypted },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      rooftopId: user.rooftopId,
      action: "rooftop.dms_config.updated",
      entityType: "Rooftop",
      entityId: user.rooftopId,
      diff: JSON.stringify({ provider: data.dmsProvider }),
    },
  });

  return NextResponse.json({ ok: true, dmsProvider: data.dmsProvider });
}
