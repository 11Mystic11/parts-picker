// [FEATURE: customer_approval_portal]
// Public customer approval portal page — no auth required.
// Customers can approve or decline individual RO line items via a magic-token link.
// Remove this file to disable.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface LineItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  partNumber: string | null;
  decision: "approved" | "declined" | null;
}

interface PortalData {
  roNumber: string | null;
  customerName: string | null;
  vehicle: { year?: number; make?: string; model?: string; vin?: string };
  status: string;
  partsSubtotal: number;
  laborSubtotal: number;
  shopSupplyFee: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: LineItem[];
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "approved" | "declined">>({});
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/${token}`);
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Failed to load" }));
      setError(msg ?? "Failed to load");
      return;
    }
    const json: PortalData = await res.json();
    setData(json);
    // Pre-populate any existing decisions
    const initial: Record<string, "approved" | "declined"> = {};
    for (const li of json.lineItems) {
      if (li.decision) initial[li.id] = li.decision;
    }
    setDecisions(initial);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!data) return;
    setSubmitting(true);
    const res = await fetch(`/api/portal/${token}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: customerName.trim() || undefined,
        decisions: Object.entries(decisions).map(([lineItemId, decision]) => ({
          lineItemId,
          decision,
        })),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Submit failed" }));
      setError(msg ?? "Submit failed");
    }
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Link unavailable</h1>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading your service estimate…</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Thank you!</h1>
        <p className="text-gray-500 dark:text-gray-400">Your responses have been saved. We&apos;ll be in touch shortly.</p>
      </div>
    );
  }

  const roLabel = data.roNumber ?? "Service Estimate";
  const vehicleName = [data.vehicle.year, data.vehicle.make, data.vehicle.model]
    .filter(Boolean)
    .join(" ");

  const serviceItems = data.lineItems.filter((li) => li.type !== "tax" && li.type !== "fee");
  const decisionCount = Object.keys(decisions).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{roLabel}</h1>
        {vehicleName && (
          <p className="text-gray-500 dark:text-gray-400 mt-1">{vehicleName}</p>
        )}
        {data.customerName && (
          <p className="text-sm text-gray-400 mt-0.5">Hi, {data.customerName}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            Tap each item to approve or decline
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {serviceItems.map((li) => {
            const dec = decisions[li.id];
            return (
              <div key={li.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{li.description}</p>
                    {li.partNumber && (
                      <p className="text-xs text-gray-400 mt-0.5">Part # {li.partNumber}</p>
                    )}
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{fmt(li.totalPrice)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setDecisions((prev) => ({ ...prev, [li.id]: "approved" }))}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold border transition-colors ${
                      dec === "approved"
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-950"
                    }`}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setDecisions((prev) => ({ ...prev, [li.id]: "declined" }))}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold border transition-colors ${
                      dec === "declined"
                        ? "bg-red-500 border-red-500 text-white"
                        : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-950"
                    }`}
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 space-y-1 text-sm">
        <div className="flex justify-between text-gray-500 dark:text-gray-400">
          <span>Parts</span><span>{fmt(data.partsSubtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-500 dark:text-gray-400">
          <span>Labor</span><span>{fmt(data.laborSubtotal)}</span>
        </div>
        {data.shopSupplyFee > 0 && (
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Shop Supply</span><span>{fmt(data.shopSupplyFee)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-500 dark:text-gray-400">
          <span>Tax</span><span>{fmt(data.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-100 dark:border-gray-800">
          <span>Total</span><span>{fmt(data.totalAmount)}</span>
        </div>
      </div>

      {/* Name + submit */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Your name (optional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || decisionCount === 0}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {submitting ? "Submitting…" : `Submit Responses (${decisionCount} item${decisionCount !== 1 ? "s" : ""})`}
        </button>

        <p className="text-xs text-center text-gray-400">
          Your responses are saved securely. We&apos;ll follow up with next steps.
        </p>
      </div>
    </div>
  );
}
