// [FEATURE: customer_approval_portal]
// Minimal public layout for the customer approval portal — no sidebar, no auth required.
// Remove this file to disable.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Approval | Parts Partner",
  description: "Review and approve your vehicle service estimate",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Minimal header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">Parts Partner</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
