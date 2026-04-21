// GET  /api/ro/[id]/notes — list categorized notes for this RO
// POST /api/ro/[id]/notes — create a new note

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const VALID_CATEGORIES = ["customer", "tech", "shop", "concern"] as const;

async function getRO(id: string, rooftopId: string) {
  return db.repairOrder.findFirst({ where: { id, rooftopId }, select: { id: true } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { id } = await params;
  if (!await getRO(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const notes = await db.rONote.findMany({
    where: { repairOrderId: id },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, role: true, employeeId: true } },
    },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { id } = await params;
  if (!await getRO(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { content, category } = body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const cat = VALID_CATEGORIES.includes(category) ? category : "shop";

  const note = await db.rONote.create({
    data: {
      repairOrderId: id,
      authorId: user.id,
      content: content.trim(),
      category: cat,
    },
    include: {
      author: { select: { id: true, name: true, role: true, employeeId: true } },
    },
  });

  return NextResponse.json(note, { status: 201 });
}
