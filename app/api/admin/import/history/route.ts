import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "developer") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      importedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ batches });
}
