// [FEATURE: core_return_tracking]
// ReturnStatusBadge — colour-coded status badge for part returns.
// Remove this file to disable.

"use client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  submitted: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  received: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  credited: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  rejected: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  received: "Received",
  credited: "Credited",
  rejected: "Rejected",
};

export function ReturnStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
