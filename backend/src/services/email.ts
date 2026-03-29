import { Resend } from "resend";
import { env } from "../env";

interface TransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

function getResendClient() {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

function getConfiguredFromAddress() {
  const from = env.SMTP_FROM?.trim();
  if (!from) {
    throw new Error("SMTP_FROM must be set to a verified Resend sender address.");
  }

  return from;
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey,
}: TransactionalEmailInput) {
  const resend = getResendClient();

  if (!resend) {
    console.log(`\n[email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }

  const from = getConfiguredFromAddress();
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    text,
    html,
    replyTo: [from],
    idempotencyKey,
  });

  if (error) {
    console.error("[email] Resend send failed", {
      to,
      subject,
      message: error.message,
      name: error.name,
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
