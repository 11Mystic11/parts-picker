import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type AdminUser = { id: string; role?: string };
type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as AdminUser;
  if (user.role !== "admin" && user.role !== "manager")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

const patchSchema = z.object({
  oem: z.string().min(1).optional(),
  partNumber: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  defaultCost: z.number().min(0).optional(),
  conditions: z.string().optional(),
  serviceIds: z.string().optional(),
  quantityRule: z.string().optional(),
  isKit: z.boolean().optional(),
  kitParts: z.string().optional(),
});

// PATCH /api/admin/rules/parts/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const part = await db.partsCatalog.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ part });
}

// DELETE /api/admin/rules/parts/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await db.partsCatalog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
