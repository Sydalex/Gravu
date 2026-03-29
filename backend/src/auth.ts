import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma";
import { env } from "./env";
import { sendTransactionalEmail } from "./services/email";

function buildOtpEmail(type: "sign-in" | "email-verification" | "forget-password" | "change-email", otp: string) {
  switch (type) {
    case "email-verification":
      return {
        subject: "Verify your Gravu email",
        text: `Your Gravu email verification code is: ${otp}\n\nEnter this code in the app to verify your email address. This code expires in 10 minutes.`,
      };
    case "forget-password":
      return {
        subject: "Reset your Gravu password",
        text: `Your Gravu password reset code is: ${otp}\n\nEnter this code in the app to continue resetting your password. This code expires in 10 minutes.`,
      };
    case "change-email":
      return {
        subject: "Confirm your new Gravu email",
        text: `Your Gravu email change code is: ${otp}\n\nEnter this code in the app to confirm your new email address. This code expires in 10 minutes.`,
      };
    case "sign-in":
    default:
      return {
        subject: "Your Gravu login code",
        text: `Your Gravu login code is: ${otp}\n\nEnter this code in the app to sign in. This code expires in 10 minutes.`,
      };
  }
}

async function sendOTPEmail(
  to: string,
  otp: string,
  type: "sign-in" | "email-verification" | "forget-password" | "change-email"
) {
  const message = buildOtpEmail(type, otp);
  await sendTransactionalEmail({
    to,
    subject: message.subject,
    text: message.text,
    html: `<p>${message.text.replace(/\n/g, "<br />")}</p>`,
    idempotencyKey: `otp-${type}/${to.toLowerCase()}/${otp}`,
  });
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
      // Trigger the initial verification email explicitly from the signup UI so
      // the client can surface send failures instead of silently navigating on.
      sendVerificationOnSignUp: false,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail(email, String(otp), type);
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
