// [FEATURE: warranty_claims]
export function WarrantyStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft:     { label: "Draft",     className: "bg-surface text-muted-foreground border border-border" },
    submitted: { label: "Submitted", className: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
    approved:  { label: "Approved",  className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
    paid:      { label: "Paid",      className: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
    rejected:  { label: "Rejected",  className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-surface text-muted-foreground" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
  );
}
