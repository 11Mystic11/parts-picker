import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/mfa/totp";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { user } = result;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
  }

  const mfa = await prisma.userMFA.findUnique({ where: { userId: user.id } });
  if (!mfa) {
    return NextResponse.json({ error: "MFA setup not started" }, { status: 400 });
  }

  const valid = verifyToken(mfa.secret, parsed.data.token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Mark MFA as fully enabled on first confirm; subsequent calls just verify session
  if (!mfa.enabledAt) {
    await prisma.userMFA.update({
      where: { userId: user.id },
      data: { enabledAt: new Date() },
    });
  }

  // Client should call useSession().update({ mfaVerified: true }) after this succeeds
  return NextResponse.json({ success: true });
}
