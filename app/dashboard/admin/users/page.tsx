import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { redirect } from "next/navigation";
import { UsersClient } from "@/components/admin/users-client";
import { MFAPolicyToggle } from "./mfa-policy-toggle";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; rooftopId?: string; role?: string } | undefined;

  if (!user?.rooftopId) redirect("/auth/signin");
  if (user.role !== "admin" && user.role !== "manager") redirect("/dashboard");

  const [users, rooftop] = await Promise.all([
    db.user.findMany({
      where: { rooftopId: user.rooftopId },
      select: { id: true, name: true, email: true, role: true, employeeId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.rooftop.findUnique({
      where: { id: user.rooftopId },
      select: { id: true, mfaRequired: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">User Management</h1>
        <p className="text-muted-foreground mb-8">Invite users, assign roles, and manage account access.</p>
        <UsersClient
          users={users.map((u) => ({ ...u, employeeId: u.employeeId ?? null, createdAt: u.createdAt.toISOString() }))}
          currentUserId={user.id}
        />
      </div>

      {rooftop && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">MFA Policy</h2>
          <p className="text-sm text-muted-foreground mb-4">
            When enabled, all users on this rooftop must verify with an authenticator app after signing in.
          </p>
          <MFAPolicyToggle
            rooftopId={rooftop.id}
            mfaRequired={rooftop.mfaRequired}
          />
        </div>
      )}
    </div>
  );
}
