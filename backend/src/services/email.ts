import { env } from "../env";

interface TransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Gravu <onboarding@resend.dev>";

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
}: TransactionalEmailInput) {
  if (!env.RESEND_API_KEY) {
    console.log(`\n[email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.SMTP_FROM?.trim() || DEFAULT_FROM,
      to: [to],
      subject,
      text,
      html,
      reply_to: env.SMTP_FROM?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to send email (${response.status}): ${body || "Unknown email provider error"}`);
  }
}
