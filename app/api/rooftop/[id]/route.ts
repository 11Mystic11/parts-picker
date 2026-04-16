import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  laborRate: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  shopSupplyPct: z.number().min(0).max(1).optional(),
  shopSupplyCap: z.number().min(0).optional(),
  timezone: z.string().optional(),
  oems: z.array(z.string()).optional(),
  mfaRequired: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rooftopId = (session.user as any)?.rooftopId;

  if (rooftopId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Only admin/manager can toggle mfaRequired
  if (parsed.data.mfaRequired !== undefined) {
    const role = (session.user as any)?.role;
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { oems, ...rest } = parsed.data;

  const updated = await prisma.rooftop.update({
    where: { id },
    data: {
      ...rest,
      ...(oems !== undefined ? { oems: JSON.stringify(oems) } : {}),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, rooftop: updated });
}
