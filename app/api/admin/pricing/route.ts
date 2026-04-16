import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";
import { DEFAULT_PRICING_TIERS } from "@/lib/pricing/calculate";

type AdminUser = { id: string; rooftopId?: string; role?: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as AdminUser;
  if (user.role !== "admin" && user.role !== "manager")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// GET /api/admin/pricing — get tiers for this rooftop (or defaults)
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const matrix = await db.pricingMatrix.findUnique({ where: { rooftopId: user.rooftopId } });

  if (!matrix) {
    return NextResponse.json({ tiers: DEFAULT_PRICING_TIERS, isDefault: true });
  }

  let tiers = DEFAULT_PRICING_TIERS;
  try {
    tiers = JSON.parse(matrix.tiers);
  } catch {
    /* use defaults */
  }

  return NextResponse.json({ tiers, isDefault: false });
}

const tierSchema = z.object({
  minCost: z.number().min(0),
  maxCost: z.number().min(0).nullable(),
  markupPct: z.number().min(0).max(10),
});

const putSchema = z.object({
  tiers: z.array(tierSchema).min(1),
});

// PUT /api/admin/pricing — upsert pricing matrix
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { tiers } = parsed.data;

  await db.pricingMatrix.upsert({
    where: { rooftopId: user.rooftopId },
    create: { rooftopId: user.rooftopId, tiers: JSON.stringify(tiers) },
    update: { tiers: JSON.stringify(tiers) },
  });

  return NextResponse.json({ ok: true, tiers });
}
