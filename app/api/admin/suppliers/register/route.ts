import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string; email?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const PARTNER_KEY = process.env.PARTSTECH_PARTNER_API_KEY;
  const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  
  // If no partner key is configured, we can't make the real API call.
  // We'll redirect back with a specific error so the UI can explain it.
  if (!PARTNER_KEY || PARTNER_KEY === "your_partner_api_key_here") {
    console.error("[partstech register] PARTSTECH_PARTNER_API_KEY not configured");
    return NextResponse.redirect(`${APP_URL}/dashboard/admin/suppliers?error=PartnerApiNotConfigured`);
  }

  // The callback URL where PartsTech will send the credentials
  const callbackUrl = `${APP_URL}/api/admin/suppliers/callback?rooftopId=${user.rooftopId}`;

  try {
    // Call PartsTech to generate the connection form URL
    // Endpoint: POST https://api.partstech.com/partner/user-connect
    const ptRes = await fetch("https://api.partstech.com/partner/user-connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PARTNER_KEY}`
      },
      body: JSON.stringify({
        email: user.email ?? "",
        callbackUrl: callbackUrl,
        smsUserId: user.rooftopId
      })
    });

    if (!ptRes.ok) {
      const errText = await ptRes.text();
      console.error("[partstech register] API Error:", ptRes.status, errText);
      return NextResponse.redirect(`${APP_URL}/dashboard/admin/suppliers?error=PartsTechApiError`);
    }

    const data = await ptRes.json();
    const registrationUrl = data.registrationUrl;

    if (!registrationUrl) {
      throw new Error("No registrationUrl returned from PartsTech");
    }

    // Redirect the user to the official PartsTech login/registration page
    return NextResponse.redirect(registrationUrl);

  } catch (error) {
    console.error("[partstech register] Exception:", error);
    return NextResponse.redirect(`${APP_URL}/dashboard/admin/suppliers?error=InternalServerError`);
  }
}
