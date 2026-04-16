import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  dealershipName: z.string().min(2),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string, table: "organization" | "rooftop") {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing =
      table === "organization"
        ? await prisma.organization.findUnique({ where: { slug: candidate } })
        : await prisma.rooftop.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    attempt++;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { dealershipName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const orgSlug = await uniqueSlug(dealershipName, "organization");
  const rooftopSlug = await uniqueSlug(dealershipName, "rooftop");

  const org = await prisma.organization.create({
    data: {
      name: dealershipName,
      slug: orgSlug,
      rooftops: {
        create: {
          name: dealershipName,
          slug: rooftopSlug,
          pricingMatrix: {
            create: {
              // Default: 30% markup <$50, 25% $50-$200, 20% >$200
              tiers: JSON.stringify([
                { minCost: 0, maxCost: 50, markupPct: 0.3 },
                { minCost: 50, maxCost: 200, markupPct: 0.25 },
                { minCost: 200, maxCost: null, markupPct: 0.2 },
              ]),
            },
          },
        },
      },
    },
    include: { rooftops: true },
  });

  const rooftop = org.rooftops[0];

  await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
      role: "admin",
      organizationId: org.id,
      rooftopId: rooftop.id,
    },
  });

  return NextResponse.json({ ok: true });
}
