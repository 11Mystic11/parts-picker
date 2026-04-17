import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) redirect("/auth/signin");
  if (!user.rooftopId) redirect("/dashboard");

  const items = await prisma.partInventory.findMany({
    where: { rooftopId: user.rooftopId, isActive: true },
    orderBy: [{ category: "asc" }, { description: "asc" }],
  });

  const canEdit = ["admin", "manager", "advisor"].includes(user.role);
  const canDelete = ["admin", "manager"].includes(user.role);

  return (
    <InventoryClient
      initialItems={items}
      canEdit={canEdit}
      canDelete={canDelete}
      userId={user.id}
    />
  );
}
