import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  rooftopId: string;
  organizationId: string;
  mfaVerified: boolean;
  rooftopMfaRequired: boolean;
  availableRooftops: { id: string; name: string }[];
}

/**
 * Require an authenticated session. Returns the session user or an error response.
 */
export async function requireAuth(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user: session.user as unknown as SessionUser };
}

/**
 * Require a specific role (or one of multiple roles).
 * Roles: "admin" | "manager" | "advisor" | "developer"
 */
export async function requireRole(
  roles: string | string[]
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const result = await requireAuth();
  if ("error" in result) return result;

  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(result.user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}

/**
 * Require that the authenticated user belongs to the given rooftop
 * (either as their primary rooftop or via UserRooftop junction).
 */
export async function requireRooftopAccess(
  rooftopId: string
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const result = await requireAuth();
  if ("error" in result) return result;

  const { user } = result;
  const hasAccess =
    user.rooftopId === rooftopId ||
    user.availableRooftops.some((r) => r.id === rooftopId);

  if (!hasAccess) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}
