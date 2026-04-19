// SMS message templates keyed by event type.
// Keep under 160 chars to fit in a single SMS segment.

export type SmsTemplateType = "estimate_ready" | "vehicle_ready" | "part_arrived" | "sop_arrived";

export function buildSmsMessage(
  type: SmsTemplateType,
  vars: {
    customerName?: string | null;
    roNumber?: string | null;
    partDescription?: string | null;
    dealerName?: string | null;
  }
): string {
  const name = vars.customerName ?? "there";
  const ro = vars.roNumber ?? "";
  const dealer = vars.dealerName ? ` – ${vars.dealerName}` : "";

  switch (type) {
    case "estimate_ready":
      return `Hi ${name}, your service estimate${ro ? ` (${ro})` : ""} is ready for review. Check your email for the approval link.${dealer}`;

    case "vehicle_ready":
      return `Hi ${name}, your vehicle is ready for pickup${ro ? ` (${ro})` : ""}! Please call us to arrange collection.${dealer}`;

    case "part_arrived":
      return `Hi ${name}, a part you ordered${vars.partDescription ? ` (${vars.partDescription})` : ""} has arrived. Please contact us to schedule installation.${dealer}`;

    case "sop_arrived":
      return `Hi ${name}, your special-ordered part${vars.partDescription ? ` (${vars.partDescription})` : ""} is in and ready for pickup. Please call to confirm.${dealer}`;

    default:
      return `Hi ${name}, you have an update from your service department.${dealer}`;
  }
}
