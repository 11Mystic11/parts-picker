import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

// GET /api/announcements — list active announcements for current rooftop
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const now = new Date();
  const announcements = await db.announcement.findMany({
    where: {
      rooftopId: user.rooftopId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true, role: true } },
    },
  });

  return NextResponse.json(announcements);
}

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required"),
  priority: z.enum(["info", "warning", "urgent"]).default("info"),
  expiresAt: z.string().datetime().optional().nullable(),
});

// POST /api/announcements — create announcement (admin/manager only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string; role?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  if (!["admin", "manager"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { title, body: bodyText, priority, expiresAt } = parsed.data;

  const announcement = await db.announcement.create({
    data: {
      rooftopId: user.rooftopId,
      authorId: user.id,
      title,
      body: bodyText,
      priority,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      author: { select: { name: true, role: true } },
    },
  });

  return NextResponse.json(announcement, { status: 201 });
}
