// [FEATURE: special_orders]
export function SOPStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ordered:           { label: "Ordered",           className: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
    received:          { label: "Received",           className: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
    customer_notified: { label: "Customer Notified",  className: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
    picked_up:         { label: "Picked Up",          className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
    cancelled:         { label: "Cancelled",          className: "bg-surface text-muted-foreground" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-surface text-muted-foreground" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
  );
}
