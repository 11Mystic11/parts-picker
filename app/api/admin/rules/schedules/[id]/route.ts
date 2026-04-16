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
  mileageInterval: z.number().int().positive().optional(),
  serviceDefinitions: z.string().optional(),
  notes: z.string().nullable().optional(),
});

// PATCH /api/admin/rules/schedules/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const schedule = await db.maintenanceSchedule.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ schedule });
}

// DELETE /api/admin/rules/schedules/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await db.maintenanceSchedule.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
