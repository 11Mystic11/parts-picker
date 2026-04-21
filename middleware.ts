import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin-only routes
    if (pathname.startsWith("/dashboard/admin")) {
      if (token?.role !== "admin" && token?.role !== "manager") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Org overview — admin/manager only
    if (pathname.startsWith("/dashboard/org")) {
      if (token?.role !== "admin" && token?.role !== "manager") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Technician-restricted routes (server-side security)
    if (token?.role === "technician") {
      if (
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/ro/new") ||
        pathname.startsWith("/dashboard/calendar") ||
        pathname.startsWith("/dashboard/customers") ||
        pathname.startsWith("/dashboard/inventory") ||
        pathname.startsWith("/dashboard/analytics") ||
        pathname.startsWith("/dashboard/settings")
      ) {
        return NextResponse.redirect(new URL("/dashboard/tech", req.url));
      }
    }

    // Force password change: redirect to /dashboard/change-password if flag set
    const mustChangePassword = token?.mustChangePassword as boolean | undefined;
    if (
      mustChangePassword &&
      !pathname.startsWith("/dashboard/change-password") &&
      !pathname.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/dashboard/change-password", req.url));
    }

    // MFA enforcement: redirect to /auth/mfa only when the mfa_enforcement feature
    // flag is enabled AND the rooftop policy requires MFA AND the user hasn't verified.
    const mfaRequired = token?.rooftopMfaRequired as boolean | undefined;
    const mfaVerified = token?.mfaVerified as boolean | undefined;
    const mfaEnforcementEnabled = token?.mfaEnforcementEnabled as boolean | undefined;
    if (
      mfaEnforcementEnabled &&
      mfaRequired &&
      !mfaVerified &&
      !pathname.startsWith("/auth/mfa")
    ) {
      return NextResponse.redirect(new URL("/auth/mfa", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
