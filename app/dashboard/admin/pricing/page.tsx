import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PricingClient } from "@/components/admin/pricing-client";

export default async function AdminPricingPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; rooftopId?: string; role?: string } | undefined;

  if (!user?.rooftopId) redirect("/auth/signin");
  if (user.role !== "admin" && user.role !== "manager") redirect("/dashboard");

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Pricing Configuration</h1>
      <p className="text-muted-foreground mb-8">Edit tiered parts markup, labor rate, tax, and shop supply rules.</p>
      <PricingClient rooftopId={user.rooftopId} />
    </div>
  );
}
