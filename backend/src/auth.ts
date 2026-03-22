import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma";
import { env } from "./env";

// ---------------------------------------------------------------------------
// Email OTP delivery
// ---------------------------------------------------------------------------
// By default, OTP codes are printed to the server console (development).
// To send real emails in production, install nodemailer:
//
//   bun add nodemailer
//   bun add -d @types/nodemailer
//
// Then replace sendOTPEmail below with a nodemailer implementation:
//
//   import nodemailer from "nodemailer";
//   const transport = nodemailer.createTransport({
//     host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 587),
//     secure: Number(env.SMTP_PORT ?? 587) === 465,
//     auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
//   });
//   async function sendOTPEmail(to: string, otp: string) {
//     await transport.sendMail({
//       from: env.SMTP_FROM ?? "noreply@example.com", to,
//       subject: "Your Gravu login code",
//       text: `Your login code is: ${otp}\n\nThis code expires in 10 minutes.`,
//     });
//   }
// ---------------------------------------------------------------------------

async function sendOTPEmail(to: string, otp: string) {
  // Development fallback – print OTP to the server console so you can copy it.
  // Replace this function with a real email implementation for production.
  console.log(`\n[OTP] Login code for ${to}: ${otp}\n`);
}

const isDev = env.NODE_ENV !== "production";

const trustedOrigins: string[] = [
  "http://localhost:*",
  "http://127.0.0.1:*",
];

if (env.ALLOWED_ORIGIN) {
  trustedOrigins.push(env.ALLOWED_ORIGIN);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  secret: env.BETTER_AUTH_SECRET,
  // baseURL tells Better Auth where the backend lives so it can construct
  // correct callback/redirect URLs.  Falls back to localhost in development.
  baseURL: env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT ?? "3000"}`,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        await sendOTPEmail(email, String(otp));
      },
    }),
  ],
  advanced: {
    // When running behind a reverse proxy, derive the baseURL from forwarded
    // headers so auth redirects and cookie domains resolve correctly.
    trustedProxyHeaders: true,
    // Cross-origin CSRF protection is handled by the CORS allowlist above.
    disableCSRFCheck: true,
    defaultCookieAttributes: {
      // In development (HTTP) use "lax" so cookies are sent without HTTPS.
      // In production (HTTPS), "none" allows cross-origin cookie delivery
      // required when the frontend and backend are on different subdomains.
      sameSite: isDev ? "lax" : "none",
      secure: !isDev,
      partitioned: !isDev,
    },
  },
});
