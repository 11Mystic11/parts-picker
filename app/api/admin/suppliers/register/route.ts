import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  // In production, these would be loaded from env vars
  const PARTNER_ID = process.env.PARTSTECH_PARTNER_ID ?? "demo_partner_id";
  const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  
  // The callback URL where PartsTech will send the credentials after the shop logs in
  const callbackUrl = `${APP_URL}/api/admin/suppliers/callback?rooftopId=${user.rooftopId}`;

  // Build the PartsTech Easy Registration URL
  // Note: For a production "One-Click" flow, you typically call the PartsTech API POST /v1/connection-forms
  // to get a unique registrationUrl. This is a simplified redirect for the showcase.
  const partstechUrl = new URL("https://www.partstech.com/registration");
  partstechUrl.searchParams.set("partnerId", PARTNER_ID);
  partstechUrl.searchParams.set("callbackUrl", callbackUrl);

  // If the user hasn't set a real partner ID yet, we'll append a flag to let the UI know
  // or we can redirect to a help page. For now, we'll try the /registration path.
  // Many partners use this pattern.
  return NextResponse.redirect(partstechUrl.toString());
}
