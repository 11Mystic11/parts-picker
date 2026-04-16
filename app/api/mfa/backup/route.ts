import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { verifyBackupCode } from "@/lib/mfa/totp";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { user } = result;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mfa = await prisma.userMFA.findUnique({ where: { userId: user.id } });
  if (!mfa?.enabledAt) {
    return NextResponse.json({ error: "MFA not enabled" }, { status: 400 });
  }

  let hashedCodes: string[] = [];
  try {
    hashedCodes = JSON.parse(mfa.backupCodes);
  } catch {
    return NextResponse.json({ error: "Invalid backup code data" }, { status: 500 });
  }

  const { valid, remaining } = await verifyBackupCode(
    parsed.data.code.toUpperCase(),
    hashedCodes
  );

  if (!valid) {
    return NextResponse.json({ error: "Invalid backup code" }, { status: 400 });
  }

  // Remove the used code
  await prisma.userMFA.update({
    where: { userId: user.id },
    data: { backupCodes: JSON.stringify(remaining) },
  });

  return NextResponse.json({ success: true, codesRemaining: remaining.length });
}
