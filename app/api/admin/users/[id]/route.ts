import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";
import { employeeIdSchema } from "@/lib/validators/employee-id";

type AdminUser = { id: string; rooftopId?: string; role?: string };
type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as AdminUser;
  if (user.role !== "admin" && user.role !== "manager")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

const patchSchema = z
  .object({
    role: z.enum(["advisor", "admin", "manager", "developer"]).optional(),
    employeeId: employeeIdSchema,
  })
  .refine((d) => d.role !== undefined || d.employeeId !== undefined, {
    message: "Provide at least one of: role, employeeId",
  });

// PATCH /api/admin/users/[id] — change role and/or employeeId
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;

  if (id === user.id)
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });

  const target = await db.user.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!target || target.rooftopId !== user.rooftopId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if ("employeeId" in parsed.data) updateData.employeeId = parsed.data.employeeId ?? null;

  try {
    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, role: true, employeeId: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Employee ID already in use on this rooftop" }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/admin/users/[id] — remove from rooftop (does not delete account)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;

  if (id === user.id)
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

  const target = await db.user.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!target || target.rooftopId !== user.rooftopId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({ where: { id }, data: { rooftopId: null } });

  return NextResponse.json({ ok: true });
}
