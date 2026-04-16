import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooftopId = (session.user as { rooftopId?: string }).rooftopId;
  if (!rooftopId) {
    return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  }

  const docs = await prisma.ingestDocument.findMany({
    where: { rooftopId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      status: true,
      extractedData: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    docs.map((d: typeof docs[number]) => ({
      ...d,
      extractedData: d.extractedData ? JSON.parse(d.extractedData) : null,
    }))
  );
}
