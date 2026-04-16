import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const APP_NAME = "Parts Partner";

/**
 * Generate a new TOTP secret for a user.
 * Returns the base32 secret and an otpauth:// URI for QR code generation.
 */
export function generateSecret(email: string): {
  secret: string;
  otpauthUrl: string;
} {
  const generated = speakeasy.generateSecret({
    name: `${APP_NAME} (${email})`,
    issuer: APP_NAME,
    length: 20,
  });

  return {
    secret: generated.base32!,
    otpauthUrl: generated.otpauth_url!,
  };
}

/**
 * Verify a 6-digit TOTP token against the stored secret.
 * Allows a ±1 step window to account for clock drift.
 */
export function verifyToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}

/**
 * Generate 10 one-time backup codes (8 alphanumeric chars each).
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars → display as XX-XXXXXX
    codes.push(code);
  }
  return codes;
}

/**
 * Bcrypt-hash all backup codes for storage.
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}

/**
 * Check if a provided backup code matches any stored hashed code.
 * Returns whether it matched and the remaining hashed codes (used code removed).
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remaining: string[] }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(code, hashedCodes[i]);
    if (match) {
      const remaining = [...hashedCodes];
      remaining.splice(i, 1);
      return { valid: true, remaining };
    }
  }
  return { valid: false, remaining: hashedCodes };
}
