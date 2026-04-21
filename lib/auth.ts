import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { flagEnabled } from "@/lib/flags/evaluate";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            rooftop: true,
            mfa: true,
            additionalRooftops: { include: { rooftop: true } },
          },
        });

        if (!user || !user.hashedPassword) return null;

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        // Build list of all accessible rooftops (primary + additional)
        const availableRooftops: { id: string; name: string }[] = [];
        if (user.rooftop) {
          availableRooftops.push({ id: user.rooftop.id, name: user.rooftop.name });
        }
        for (const ur of user.additionalRooftops) {
          if (!availableRooftops.find((r) => r.id === ur.rooftop.id)) {
            availableRooftops.push({ id: ur.rooftop.id, name: ur.rooftop.name });
          }
        }

        // MFA is only "required to verify" if it's been fully enabled (enabledAt set)
        const mfaEnabled = !!user.mfa?.enabledAt;
        const rooftopMfaRequired = user.rooftop?.mfaRequired ?? false;
        // Check whether the mfa_enforcement feature flag is active for this rooftop.
        // Stored in JWT so middleware can read it without hitting the DB.
        const mfaEnforcementEnabled = await flagEnabled("mfa_enforcement", user.rooftopId);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          rooftopId: user.rooftopId,
          organizationId: user.organizationId,
          mustChangePassword: user.mustChangePassword,
          // MFA not verified yet on a fresh login
          mfaVerified: !mfaEnabled,
          rooftopMfaRequired,
          mfaEnforcementEnabled,
          availableRooftops,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial sign-in, copy all fields from authorize() return value
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.rooftopId = (user as any).rooftopId;
        token.organizationId = (user as any).organizationId;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
        token.mfaVerified = (user as any).mfaVerified ?? true;
        token.rooftopMfaRequired = (user as any).rooftopMfaRequired ?? false;
        token.mfaEnforcementEnabled = (user as any).mfaEnforcementEnabled ?? false;
        token.availableRooftops = (user as any).availableRooftops ?? [];
      }

      // Allow clearing mustChangePassword after password change
      if (trigger === "update" && session && typeof session.mustChangePassword === "boolean") {
        token.mustChangePassword = session.mustChangePassword;
      }

      // Handle session.update() calls from the client
      if (trigger === "update" && session) {
        // MFA verified after TOTP/backup code check
        if (typeof session.mfaVerified === "boolean") {
          token.mfaVerified = session.mfaVerified;
        }
        // Rooftop switch — only allow rooftops in the user's available list
        if (session.rooftopId) {
          const available = (token.availableRooftops as { id: string; name: string }[]) ?? [];
          const isAllowed = available.some((r) => r.id === session.rooftopId);
          if (isAllowed) {
            token.rooftopId = session.rooftopId;
            // Refresh mfaRequired for the newly selected rooftop
            const rooftop = await prisma.rooftop.findUnique({
              where: { id: session.rooftopId },
              select: { mfaRequired: true },
            });
            token.rooftopMfaRequired = rooftop?.mfaRequired ?? false;
            // Refresh mfa_enforcement flag for the new rooftop
            token.mfaEnforcementEnabled = await flagEnabled("mfa_enforcement", session.rooftopId);
            // If new rooftop requires MFA, re-gate verification
            if (rooftop?.mfaRequired) {
              token.mfaVerified = false;
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).rooftopId = token.rooftopId;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).mfaVerified = token.mfaVerified ?? true;
        (session.user as any).rooftopMfaRequired = token.rooftopMfaRequired ?? false;
        (session.user as any).availableRooftops = token.availableRooftops ?? [];
      }
      return session;
    },
  },
};
