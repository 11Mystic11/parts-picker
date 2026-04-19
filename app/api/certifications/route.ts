// [FEATURE: certifications]
// Tech certifications — list and create.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  userId: z.string().min(1),
  certType: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  certNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const userId = req.nextUrl.searchParams.get("userId");

  const certs = await prisma.techCertification.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(userId ? { userId } : {}),
    },
    include: { user: { select: { name: true, role: true } } },
    orderBy: [{ userId: "asc" }, { expiresAt: "asc" }],
  });

  return NextResponse.json({ certs });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const cert = await prisma.techCertification.create({
    data: {
      userId: parsed.data.userId,
      rooftopId: user.rooftopId,
      certType: parsed.data.certType,
      name: parsed.data.name,
      issuedAt: parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      certNumber: parsed.data.certNumber ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ cert }, { status: 201 });
}
