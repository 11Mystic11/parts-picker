// [FEATURE: fleet_accounts]
// Fleet Account Management — list and create fleet accounts.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  companyName: z.string().min(1).max(255),
  contactName: z.string().max(255).optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable(),
  billingCycle: z.enum(["weekly", "monthly"]).optional(),
  requiresPo: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const accounts = await prisma.fleetAccount.findMany({
    where: { rooftopId: user.rooftopId, isActive: true },
    include: {
      _count: { select: { repairOrders: true } },
    },
    orderBy: { companyName: "asc" },
  });

  // Compute open RO counts
  const openROCounts = await Promise.all(
    accounts.map((a) =>
      prisma.repairOrder.count({
        where: { fleetAccountId: a.id, status: { notIn: ["closed", "cancelled"] } },
      })
    )
  );

  const result = accounts.map((a, i) => ({
    ...a,
    openROCount: openROCounts[i],
    totalROCount: a._count.repairOrders,
  }));

  return NextResponse.json({ accounts: result });
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

  const account = await prisma.fleetAccount.create({
    data: {
      rooftopId: user.rooftopId,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      billingCycle: parsed.data.billingCycle ?? "monthly",
      requiresPo: parsed.data.requiresPo ?? false,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
