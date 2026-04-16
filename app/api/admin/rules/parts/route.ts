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

// GET /api/admin/rules/parts?oem=GM
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const oem = req.nextUrl.searchParams.get("oem") || undefined;

  const parts = await db.partsCatalog.findMany({
    where: oem ? { oem, isActive: true } : { isActive: true },
    orderBy: [{ oem: "asc" }, { partNumber: "asc" }],
  });

  return NextResponse.json({ parts });
}

const createSchema = z.object({
  oem: z.string().min(1),
  partNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  defaultCost: z.number().min(0),
  conditions: z.string().optional(),
  serviceIds: z.string().optional(),
  quantityRule: z.string().optional(),
  isKit: z.boolean().optional(),
  kitParts: z.string().optional(),
});

// POST /api/admin/rules/parts
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await db.partsCatalog.findFirst({
    where: { oem: parsed.data.oem, partNumber: parsed.data.partNumber, isActive: true },
  });
  const nextVersion = existing ? existing.version + 1 : 1;

  const part = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (existing) {
      await tx.partsCatalog.update({ where: { id: existing.id }, data: { isActive: false } });
    }
    return tx.partsCatalog.create({
      data: { ...parsed.data, version: nextVersion, isActive: true, effectiveDate: new Date() },
    });
  });
  return NextResponse.json({ part }, { status: 201 });
}
