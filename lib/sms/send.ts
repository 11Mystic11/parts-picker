// Generic SMS sender via Twilio Basic Auth — same pattern as lib/approval/send-link.ts.
// Reads creds from env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.

export interface SmsSendResult {
  sent: boolean;
  error?: string;
}

export async function sendSms({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<SmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !auth || !from) {
    return { sent: false, error: "Twilio env vars not configured" };
  }

  const params = new URLSearchParams({ To: to, From: from, Body: message });

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
    if (res.ok) return { sent: true };
    const err = await res.text();
    return { sent: false, error: `Twilio error: ${err}` };
  } catch (e) {
    return { sent: false, error: `SMS exception: ${String(e)}` };
  }
}
