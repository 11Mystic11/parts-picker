import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { FLAG_KEYS, getAllFlags, setFlag, FlagKey } from "@/lib/flags/evaluate";

function adminGuard(session: Awaited<ReturnType<typeof getServerSession>> | null) {
  const role = (session as any)?.user?.role;
  return role === "admin" || role === "developer";
}

/**
 * GET /api/admin/flags?rooftopId=<id>
 * Returns all flags merged (rooftop overrides + globals + defaults).
 * rooftopId is optional — omit for global-only view.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminGuard(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rooftopId = req.nextUrl.searchParams.get("rooftopId") ?? null;
  const flags = await getAllFlags(rooftopId);
  return NextResponse.json({ flags, flagKeys: FLAG_KEYS });
}

const patchSchema = z.object({
  flagKey: z.string(),
  enabled: z.boolean(),
  rooftopId: z.string().nullable().optional(), // null = global
});

/**
 * PATCH /api/admin/flags
 * Upsert a single flag record.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminGuard(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { flagKey, enabled, rooftopId } = parsed.data;

  if (!(FLAG_KEYS as readonly string[]).includes(flagKey)) {
    return NextResponse.json({ error: `Unknown flag key: ${flagKey}` }, { status: 400 });
  }

  await setFlag(flagKey as FlagKey, enabled, rooftopId);
  return NextResponse.json({ ok: true });
}
