// [FEATURE: dvi]
// POST   /api/ro/[id]/dvi/items/[itemId]/upload — upload a photo/video to Vercel Blob
// DELETE /api/ro/[id]/dvi/items/[itemId]/upload — remove a photo URL from the item
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { put, del } from "@vercel/blob";

type Params = { params: Promise<{ id: string; itemId: string }> };

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
]);

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id, itemId } = await params;

  const enabled = await flagEnabled("dvi" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await db.dVIItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "DVI item not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Use JPEG, PNG, WebP, HEIC, or MP4." },
      { status: 400 }
    );
  }

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const blob = await put(
    `dvi/${id}/${itemId}/${Date.now()}.${ext}`,
    file,
    { access: "public" }
  );

  // Append URL to photoUrls JSON array
  let urls: string[] = [];
  try { urls = JSON.parse(item.photoUrls); } catch { /* start fresh */ }
  urls.push(blob.url);

  await db.dVIItem.update({
    where: { id: itemId },
    data: { photoUrls: JSON.stringify(urls) },
  });

  return NextResponse.json({ url: blob.url });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id, itemId } = await params;

  const enabled = await flagEnabled("dvi" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await db.dVIItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "DVI item not found" }, { status: 404 });

  let body: { url: string } | null = null;
  try { body = await req.json(); } catch { /* ignore */ }
  const url = body?.url;
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  // Remove from Vercel Blob
  try { await del(url); } catch { /* if blob already gone, ignore */ }

  let urls: string[] = [];
  try { urls = JSON.parse(item.photoUrls); } catch { /* ignore */ }
  const filtered = urls.filter((u) => u !== url);

  await db.dVIItem.update({
    where: { id: itemId },
    data: { photoUrls: JSON.stringify(filtered) },
  });

  return NextResponse.json({ success: true });
}
