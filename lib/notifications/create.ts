// Shared helper — creates an in-app notification for a user.
// Used by any feature that generates events (SOP arrival, backorder cleared, RO approved, etc.)
import { prisma } from "@/lib/db";

export interface NotificationPayload {
  rooftopId: string;
  userId: string;
  title: string;
  body: string;
  type:
    | "ro_approved"
    | "parts_arrived"
    | "dms_sync_failed"
    | "inspection_flagged"
    | "recall_found"
    | "sop_arrived"
    | "backorder_cleared"
    | "general";
  entityId?: string;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        rooftopId: payload.rooftopId,
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        entityId: payload.entityId ?? null,
      },
    });
  } catch {
    // Notification failures are non-critical — log but don't throw
    console.error("[notifications] Failed to create notification:", payload);
  }
}
