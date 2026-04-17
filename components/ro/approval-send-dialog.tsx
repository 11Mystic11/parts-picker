// [FEATURE: customer_approval_portal]
// ApprovalSendDialog — modal to generate and send a customer approval link from the RO detail page.
// Remove this file and its usage in app/dashboard/ro/[id]/ro-detail-client.tsx to disable.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Copy, Check, X } from "lucide-react";

interface ApprovalSendDialogProps {
  roId: string;
  customerPhone: string | null;
  customerEmail: string | null;
  onClose: () => void;
}

export function ApprovalSendDialog({
  roId,
  customerPhone,
  customerEmail,
  onClose,
}: ApprovalSendDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    approvalUrl: string;
    smsSent: boolean;
    emailSent: boolean;
    errors: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendSms, setSendSms] = useState(!!customerPhone);
  const [sendEmail, setSendEmail] = useState(!!customerEmail);

  async function handleSend() {
    setLoading(true);
    const res = await fetch(`/api/ro/${roId}/approval-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendSms, sendEmail }),
    });
    setLoading(false);
    if (res.ok) {
      setResult(await res.json());
    } else {
      const { error } = await res.json().catch(() => ({ error: "Request failed" }));
      alert(error ?? "Failed to generate approval link");
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.approvalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-900 dark:text-white">Send Approval Link</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate a secure link for your customer to approve or decline individual service items without needing to call in.
              </p>

              {customerPhone && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Send SMS to {customerPhone}
                  </span>
                </label>
              )}

              {customerEmail && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Send email to {customerEmail}
                  </span>
                </label>
              )}

              {!customerPhone && !customerEmail && (
                <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                  No customer contact info on this RO. The link will be generated but cannot be sent automatically.
                </p>
              )}

              <Button
                onClick={handleSend}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Generating…" : "Generate & Send Link"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                {result.smsSent && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" /> SMS sent successfully
                  </div>
                )}
                {result.emailSent && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" /> Email sent successfully
                  </div>
                )}
                {result.errors.map((err, i) => (
                  <div key={i} className="text-sm text-amber-600 dark:text-amber-400">⚠ {err}</div>
                ))}
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Shareable link (expires in 72h)</p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate font-mono">
                    {result.approvalUrl}
                  </span>
                  <button
                    onClick={copyLink}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button variant="outline" onClick={onClose} className="w-full">
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
