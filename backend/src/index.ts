import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { env } from "./env";
import { startCenterlineSidecar } from "./services/centerlineSidecar";
import { auth } from "./auth";
import { sampleRouter } from "./routes/sample";
import { traceRouter } from "./routes/trace";
import { aiRouter } from "./routes/ai";
import { convertRouter } from "./routes/convert";
import { conversionsRouter } from "./routes/conversions";
import { paymentsRouter } from "./routes/payments";
import { adminRouter } from "./routes/admin";
import { logger } from "hono/logger";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// CORS middleware - validates origin against allowlist
// Add your production domain to ALLOWED_ORIGIN in .env (e.g. https://your-app.example.com)
const allowed: RegExp[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

if (env.ALLOWED_ORIGIN) {
  // Escape for use in a regexp and add exact match
  const escaped = env.ALLOWED_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  allowed.push(new RegExp(`^${escaped}$`));
}

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Auth middleware - populates user/session for all routes
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth handler
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/trace", traceRouter);
app.route("/api/ai", aiRouter);
app.route("/api/convert", convertRouter);
app.route("/api/conversions", conversionsRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/admin", adminRouter);

const port = Number(process.env.PORT) || 3000;

// Start the centerline vectorizer sidecar (no-op if not configured for localhost)
startCenterlineSidecar().then(() => {
  console.log(`Started development server: http://localhost:${port}`);
}).catch((err) => {
  console.error("[centerline-sidecar] Failed to start:", err);
});

export default {
  port,
  fetch: app.fetch,
};
