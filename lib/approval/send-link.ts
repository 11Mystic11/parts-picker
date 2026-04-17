// [FEATURE: customer_approval_portal]
// Sends the customer approval link via SMS (Twilio) and/or email (Resend).
// Uses fetch + Basic Auth — no additional npm packages required.
// Remove this file and its call site in app/api/ro/[id]/approval-token/route.ts to disable.

interface ROInfo {
  id: string;
  roNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
}

interface SendResult {
  smsSent: boolean;
  emailSent: boolean;
  errors: string[];
}

export async function sendApprovalLink(
  ro: ROInfo,
  token: string,
  baseUrl: string
): Promise<SendResult> {
  const approvalUrl = `${baseUrl}/portal/${token}`;
  const roLabel = ro.roNumber ?? `RO-${ro.id.slice(-8).toUpperCase()}`;
  const result: SendResult = { smsSent: false, emailSent: false, errors: [] };

  // ── SMS via Twilio ────────────────────────────────────────────────────────
  if (ro.customerPhone) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (sid && auth && from) {
      const body = `Hi ${ro.customerName ?? "there"}, your vehicle service estimate (${roLabel}) is ready for review. Approve or decline items here: ${approvalUrl}`;
      const params = new URLSearchParams({
        To: ro.customerPhone,
        From: from,
        Body: body,
      });

      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          }
        );
        if (res.ok) {
          result.smsSent = true;
        } else {
          const err = await res.text();
          result.errors.push(`SMS failed: ${err}`);
        }
      } catch (e) {
        result.errors.push(`SMS error: ${String(e)}`);
      }
    } else {
      result.errors.push("SMS skipped: Twilio env vars not set");
    }
  }

  // ── Email via Resend ──────────────────────────────────────────────────────
  if (ro.customerEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM ?? "noreply@example.com";

    if (apiKey) {
      const html = `
        <p>Hi ${ro.customerName ?? "there"},</p>
        <p>Your vehicle service estimate (<strong>${roLabel}</strong>) is ready for review.</p>
        <p><a href="${approvalUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Review &amp; Approve</a></p>
        <p style="color:#6b7280;font-size:13px;">This link expires in 72 hours.</p>
      `;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [ro.customerEmail],
            subject: `Service estimate ready — ${roLabel}`,
            html,
          }),
        });
        if (res.ok) {
          result.emailSent = true;
        } else {
          const err = await res.text();
          result.errors.push(`Email failed: ${err}`);
        }
      } catch (e) {
        result.errors.push(`Email error: ${String(e)}`);
      }
    } else {
      result.errors.push("Email skipped: RESEND_API_KEY not set");
    }
  }

  return result;
}
