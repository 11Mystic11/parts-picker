import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { extractFromDocument } from "@/lib/ingest/extract";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id?: string; rooftopId?: string };
  const rooftopId = user.rooftopId;
  const uploadedById = user.id;

  if (!rooftopId || !uploadedById) {
    return NextResponse.json({ error: "No rooftop assigned to user" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload PNG, JPG, WebP, or PDF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit." }, { status: 400 });
  }

  // Upload to Vercel Blob
  const blobName = `ingest/${rooftopId}/${Date.now()}-${file.name}`;
  const blob = await put(blobName, file, { access: "public" });

  // Read buffer for Claude
  const buffer = Buffer.from(await file.arrayBuffer());

  // Run extraction
  let extractedData: object | null = null;
  let status = "done";
  let errorMessage: string | undefined;

  try {
    const result = await extractFromDocument(buffer, file.type);
    extractedData = result;
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "Extraction failed";
  }

  // Persist to DB
  const doc = await prisma.ingestDocument.create({
    data: {
      rooftopId,
      uploadedById,
      blobUrl: blob.url,
      fileName: file.name,
      mimeType: file.type,
      status,
      extractedData: extractedData ? JSON.stringify(extractedData) : null,
      errorMessage,
    },
  });

  return NextResponse.json({
    id: doc.id,
    status: doc.status,
    extractedData,
    errorMessage,
  });
}
