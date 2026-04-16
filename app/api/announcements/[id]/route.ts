import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  priority: z.enum(["info", "warning", "urgent"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// PATCH /api/announcements/[id] — edit announcement (admin/manager only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string; role?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!["admin", "manager"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.announcement.findFirst({ where: { id, rooftopId: user.rooftopId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { title, body: bodyText, priority, expiresAt } = parsed.data;

  const updated = await db.announcement.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(bodyText !== undefined && { body: bodyText }),
      ...(priority !== undefined && { priority }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
    include: {
      author: { select: { name: true, role: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/announcements/[id] — delete announcement (admin/manager only)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string; role?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!["admin", "manager"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.announcement.findFirst({ where: { id, rooftopId: user.rooftopId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.announcement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
