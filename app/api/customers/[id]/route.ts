// GET    /api/customers/[id] — full customer profile with RO history
// PATCH  /api/customers/[id] — update customer
// DELETE /api/customers/[id] — delete customer

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

async function getCustomer(id: string, rooftopId: string) {
  const c = await db.customer.findUnique({ where: { id } });
  if (!c || c.rooftopId !== rooftopId) return null;
  return c;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      repairOrders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, roNumber: true, status: true, vin: true,
          vehicleSnapshot: true, createdAt: true, scheduledAt: true,
          totalAmount: true,
          advisor: { select: { name: true } },
          lineItems: {
            where: { isAccepted: true, type: { in: ["service", "labor"] } },
            select: { description: true },
            take: 3,
            orderBy: { sortOrder: "asc" },
          },
        },
        take: 50,
      },
    },
  });

  if (!customer || customer.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ customer });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  if (!user.rooftopId || !await getCustomer(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const updated = await db.customer.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
    },
  });

  return NextResponse.json({ customer: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  const { id } = await params;

  if (!user.rooftopId || !await getCustomer(id, user.rooftopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
