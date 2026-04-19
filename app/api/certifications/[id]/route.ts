// [FEATURE: certifications]
// PATCH/DELETE a single tech certification.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  certType: z.string().max(50).optional(),
  name: z.string().max(200).optional(),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  certNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const cert = await prisma.techCertification.findUnique({ where: { id } });
  if (!cert || cert.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.certType !== undefined) data.certType = parsed.data.certType;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.issuedAt !== undefined) data.issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null;
  if (parsed.data.expiresAt !== undefined) data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (parsed.data.certNumber !== undefined) data.certNumber = parsed.data.certNumber;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const updated = await prisma.techCertification.update({ where: { id }, data });
  return NextResponse.json({ cert: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const cert = await prisma.techCertification.findUnique({ where: { id } });
  if (!cert || cert.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.techCertification.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
