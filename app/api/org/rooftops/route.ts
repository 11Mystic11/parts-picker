import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; organizationId?: string; rooftopId?: string };
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Copy financial defaults from the current rooftop so the new one starts sensibly
  const currentRooftop = user.rooftopId
    ? await prisma.rooftop.findUnique({
        where: { id: user.rooftopId },
        select: { laborRate: true, taxRate: true, shopSupplyPct: true, shopSupplyCap: true },
      })
    : null;

  // Generate a unique slug from the name
  const baseSlug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.rooftop.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const rooftop = await prisma.rooftop.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      slug,
      timezone: parsed.data.timezone,
      laborRate: currentRooftop?.laborRate ?? 125,
      taxRate: currentRooftop?.taxRate ?? 0.07,
      shopSupplyPct: currentRooftop?.shopSupplyPct ?? 0.08,
      shopSupplyCap: currentRooftop?.shopSupplyCap ?? 45,
    },
  });

  return NextResponse.json({ rooftop }, { status: 201 });
}
