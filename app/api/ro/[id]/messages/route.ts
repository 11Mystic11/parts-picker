import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

// GET /api/ro/[id]/messages — list all messages/notes for this RO
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { id } = await params;

  // Verify RO belongs to user's rooftop
  const ro = await db.repairOrder.findFirst({
    where: { id, rooftopId: user.rooftopId },
    select: { id: true },
  });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.rOMessage.findMany({
    where: { repairOrderId: id },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: { id: true, name: true, role: true, employeeId: true },
      },
    },
  });

  return NextResponse.json(messages);
}

// POST /api/ro/[id]/messages — create a new message or note
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { id } = await params;

  // Verify RO belongs to user's rooftop
  const ro = await db.repairOrder.findFirst({
    where: { id, rooftopId: user.rooftopId },
    select: { id: true },
  });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { content, category } = body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const validCategories = ["message", "note", "external"];
  const cat = validCategories.includes(category) ? category : "message";

  const message = await db.rOMessage.create({
    data: {
      repairOrderId: id,
      authorId: user.id,
      content: content.trim(),
      category: cat,
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, employeeId: true },
      },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
