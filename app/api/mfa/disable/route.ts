import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const bodySchema = z.object({
  password: z.string().min(1),
  // Admin can pass targetUserId to disable another user's MFA
  targetUserId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { user } = result;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { password, targetUserId } = parsed.data;

  // If targeting another user, must be admin
  if (targetUserId && targetUserId !== user.id) {
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const userId = targetUserId ?? user.id;

  // Re-verify the requesting user's password before disabling
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.hashedPassword) {
    return NextResponse.json({ error: "Cannot verify identity" }, { status: 400 });
  }
  const passwordValid = await bcrypt.compare(password, dbUser.hashedPassword);
  if (!passwordValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
  }

  await prisma.userMFA.deleteMany({ where: { userId } });

  return NextResponse.json({ success: true });
}
