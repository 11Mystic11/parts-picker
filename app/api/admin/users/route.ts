import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { employeeIdSchema } from "@/lib/validators/employee-id";

type AdminUser = { id: string; rooftopId?: string; role?: string; organizationId?: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as AdminUser;
  if (user.role !== "admin" && user.role !== "manager")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// GET /api/admin/users — list users in this rooftop
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const users = await db.user.findMany({
    where: { rooftopId: user.rooftopId },
    select: { id: true, name: true, email: true, role: true, employeeId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["advisor", "technician", "admin", "manager", "developer"]),
  employeeId: employeeIdSchema,
});

const TEMP_PASSWORD = "TempPass123!";

// POST /api/admin/users — invite a new user
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { name, email, role, employeeId } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

  try {
    const created = await db.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role,
        rooftopId: user.rooftopId,
        organizationId: user.organizationId,
        employeeId: employeeId ?? null,
      },
      select: { id: true, name: true, email: true, role: true, employeeId: true, createdAt: true },
    });

    return NextResponse.json({ user: created, tempPassword: TEMP_PASSWORD }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Employee ID already in use on this rooftop" }, { status: 409 });
    }
    throw err;
  }
}
