import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { redirect } from "next/navigation";
import { RulesClient } from "@/components/admin/rules-client";

export default async function AdminRulesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; rooftopId?: string; role?: string } | undefined;

  if (!user?.rooftopId) redirect("/auth/signin");
  if (user.role !== "admin" && user.role !== "manager") redirect("/dashboard");

  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId },
    select: { oems: true },
  });

  let oemList: string[] = [];
  try {
    oemList = JSON.parse(rooftop?.oems ?? "[]");
  } catch {
    oemList = [];
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Rules Manager</h1>
      <p className="text-muted-foreground mb-8">Manage OEM maintenance schedules, parts catalog, labor ops, and OTPR rules.</p>
      <RulesClient oemList={oemList} />
    </div>
  );
}
