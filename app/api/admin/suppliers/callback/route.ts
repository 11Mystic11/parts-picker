import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { encryptConfig, decryptConfig } from "@/lib/dms/adapter";

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

async function handleCallback(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let rooftopId = searchParams.get("rooftopId");

  let apiKey = "";
  let shopId = "";

  if (req.method === "POST") {
    try {
      // Handle official PartsTech response format
      const body = await req.json();
      
      // PartsTech sends smsUserId (rooftopId) in the body
      if (body.smsUserId && !rooftopId) {
        rooftopId = body.smsUserId;
      }

      // Extract credentials from user object
      if (body.user) {
        apiKey = body.user.apiKey;
        shopId = body.user.username || body.user.shopId || "";
      } else {
        // Fallback for flat structure
        apiKey = body.apiKey;
        shopId = body.shopId;
      }
    } catch (e) {
      console.error("[suppliers callback] Error parsing POST body:", e);
    }
  } else {
    // For local mocking/testing via GET
    apiKey = searchParams.get("apiKey") ?? "pt_mock_live_key_" + Math.random().toString(36).substring(7);
    shopId = searchParams.get("shopId") ?? "SHOP_MOCK_123";
  }

  if (!rooftopId) {
    return NextResponse.json({ error: "Missing rooftopId" }, { status: 400 });
  }

  if (!apiKey || !shopId) {
    // If we're missing credentials, redirect back to the suppliers page with an error
    return NextResponse.redirect(`${new URL(req.url).origin}/dashboard/admin/suppliers?error=CallbackMissingCredentials`);
  }

  // Load existing config, merge PartsTech, re-encrypt
  const rooftop = await db.rooftop.findUnique({
    where: { id: rooftopId },
    select: { supplierConfig: true },
  });

  if (!rooftop) {
     return NextResponse.redirect(`${new URL(req.url).origin}/dashboard/admin/suppliers?error=RooftopNotFound`);
  }

  let existing: Record<string, Record<string, string>> = {};
  if (rooftop.supplierConfig) {
    existing = decryptConfig<Record<string, Record<string, string>>>(rooftop.supplierConfig) ?? {};
  }

  existing["partstech"] = { apiKey, shopId };
  const encrypted = encryptConfig(existing);

  await db.rooftop.update({
    where: { id: rooftopId },
    data: { supplierConfig: encrypted },
  });

  // Redirect the user back to the suppliers page
  return NextResponse.redirect(`${new URL(req.url).origin}/dashboard/admin/suppliers?success=partstech`);
}
