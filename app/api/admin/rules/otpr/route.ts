import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

type AdminUser = { id: string; role?: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as AdminUser;
  if (user.role !== "admin" && user.role !== "manager")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// GET /api/admin/rules/otpr?oem=GM
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const oem = req.nextUrl.searchParams.get("oem") || undefined;

  const rules = await db.oTPRRule.findMany({
    where: oem ? { oem, isActive: true } : { isActive: true },
    orderBy: [{ oem: "asc" }, { mileageThreshold: "asc" }],
  });

  return NextResponse.json({ rules });
}

const createSchema = z.object({
  oem: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  serviceCategory: z.string().min(1),
  mileageThreshold: z.number().int().positive(),
  partNumbers: z.string().optional(),
  urgencyTier: z.enum(["urgent", "suggested", "informational"]),
  conditions: z.string().optional(),
  isActive: z.boolean().optional(),
});

// POST /api/admin/rules/otpr
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await db.oTPRRule.findFirst({
    where: { oem: parsed.data.oem, name: parsed.data.name, isActive: true },
  });
  const nextVersion = existing ? existing.version + 1 : 1;

  const rule = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (existing) {
      await tx.oTPRRule.update({ where: { id: existing.id }, data: { isActive: false } });
    }
    return tx.oTPRRule.create({
      data: { ...parsed.data, version: nextVersion, isActive: true, effectiveDate: new Date() },
    });
  });
  return NextResponse.json({ rule }, { status: 201 });
}
