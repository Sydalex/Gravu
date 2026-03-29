import { Resend } from "resend";
import { env } from "../env";

interface TransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

const resend = new Resend(env.RESEND_API_KEY);

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
  if (!env.RESEND_API_KEY) {
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
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
