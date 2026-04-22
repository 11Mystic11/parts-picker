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
  const rooftopId = searchParams.get("rooftopId");

  if (!rooftopId) {
    return NextResponse.json({ error: "Missing rooftopId" }, { status: 400 });
  }

  let apiKey = "";
  let shopId = "";

  if (req.method === "POST") {
    try {
      // Handle both JSON and form data depending on what PartsTech sends
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        apiKey = body.apiKey;
        shopId = body.shopId;
      } else {
        const formData = await req.formData();
        apiKey = formData.get("apiKey")?.toString() ?? "";
        shopId = formData.get("shopId")?.toString() ?? "";
      }
    } catch (e) {
      console.error("[suppliers callback] Error parsing POST body:", e);
    }
  } else {
    // For local mocking/testing via GET
    apiKey = searchParams.get("apiKey") ?? "pt_mock_live_key_" + Math.random().toString(36).substring(7);
    shopId = searchParams.get("shopId") ?? "SHOP_MOCK_123";
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
