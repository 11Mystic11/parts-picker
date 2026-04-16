import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { previewImport, commitImport } from "@/lib/oem/import";
import { OEMEntityType } from "@/lib/oem/versioning";

const ENTITY_TYPES: OEMEntityType[] = [
  "MaintenanceSchedule",
  "PartsCatalog",
  "LaborOperation",
  "OTPRRule",
];

const BodySchema = z.object({
  entityType: z.enum([
    "MaintenanceSchedule",
    "PartsCatalog",
    "LaborOperation",
    "OTPRRule",
  ]),
  records: z.array(z.record(z.string(), z.unknown())),
  // "preview" returns a diff without writing; "commit" writes to DB
  mode: z.enum(["preview", "commit"]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "developer") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { entityType, records, mode } = parsed.data;

  if (!ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: "Unknown entity type" }, { status: 400 });
  }

  if (mode === "preview") {
    const preview = await previewImport(entityType, records);
    return NextResponse.json(preview);
  }

  // commit
  const result = await commitImport(entityType, records, user.id);
  return NextResponse.json(result);
}
