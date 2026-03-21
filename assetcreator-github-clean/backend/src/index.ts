import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { startCenterlineSidecar } from "./services/centerlineSidecar";
import { auth } from "./auth";
import { sampleRouter } from "./routes/sample";
import { traceRouter } from "./routes/trace";
import { aiRouter } from "./routes/ai";
import { convertRouter } from "./routes/convert";
import { conversionsRouter } from "./routes/conversions";
import { paymentsRouter } from "./routes/payments";
import { logger } from "hono/logger";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

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
