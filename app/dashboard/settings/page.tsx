import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RooftopSettingsForm } from "./rooftop-settings-form";
import { MFASettingsSection } from "./mfa-settings-section";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const rooftopId = user?.rooftopId;
  if (!rooftopId) redirect("/auth/signin");

  const [rooftop, mfaRecord] = await Promise.all([
    prisma.rooftop.findUnique({
      where: { id: rooftopId },
      include: { pricingMatrix: { select: { tiers: true } } },
    }),
    prisma.userMFA.findUnique({ where: { userId: user.id } }),
  ]);

  if (!rooftop) redirect("/auth/signin");

  const mfaEnabled = !!mfaRecord?.enabledAt;

  return (
    <div className="p-6 max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Rooftop Settings</h1>
        <RooftopSettingsForm rooftop={rooftop} />
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Security</h2>
        <MFASettingsSection mfaEnabled={mfaEnabled} />
      </div>
    </div>
  );
}
