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

// GET /api/admin/rules/labor?oem=GM
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const oem = req.nextUrl.searchParams.get("oem") || undefined;

  const laborOps = await db.laborOperation.findMany({
    where: oem ? { oem, isActive: true } : { isActive: true },
    orderBy: [{ oem: "asc" }, { opCode: "asc" }],
  });

  return NextResponse.json({ laborOps });
}

const createSchema = z.object({
  oem: z.string().min(1),
  opCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  flatRateHours: z.number().min(0),
  serviceIds: z.string().optional(),
  conditions: z.string().optional(),
});

// POST /api/admin/rules/labor
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await db.laborOperation.findFirst({
    where: { oem: parsed.data.oem, opCode: parsed.data.opCode, isActive: true },
  });
  const nextVersion = existing ? existing.version + 1 : 1;

  const laborOp = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (existing) {
      await tx.laborOperation.update({ where: { id: existing.id }, data: { isActive: false } });
    }
    return tx.laborOperation.create({
      data: { ...parsed.data, version: nextVersion, isActive: true, effectiveDate: new Date() },
    });
  });
  return NextResponse.json({ laborOp }, { status: 201 });
}
