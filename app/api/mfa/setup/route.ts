import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { generateSecret, generateBackupCodes, hashBackupCodes } from "@/lib/mfa/totp";
import QRCode from "qrcode";

export async function POST() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { user } = result;

  // Check if MFA is already fully enabled
  const existing = await prisma.userMFA.findUnique({ where: { userId: user.id } });
  if (existing?.enabledAt) {
    return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
  }

  const { secret, otpauthUrl } = generateSecret(user.email);
  const rawBackupCodes = generateBackupCodes();
  const hashedCodes = await hashBackupCodes(rawBackupCodes);

  // Upsert a pending MFA record (enabledAt stays null until verify confirms it)
  await prisma.userMFA.upsert({
    where: { userId: user.id },
    update: {
      secret,
      backupCodes: JSON.stringify(hashedCodes),
      enabledAt: null,
    },
    create: {
      userId: user.id,
      secret,
      backupCodes: JSON.stringify(hashedCodes),
      enabledAt: null,
    },
  });

  // Generate QR code as a data URI for the client
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({
    qrDataUrl,
    secret, // show manual entry fallback
    backupCodes: rawBackupCodes, // shown once to user before they confirm
  });
}
