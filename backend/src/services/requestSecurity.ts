import type { MiddlewareHandler } from "hono";
import { env } from "../env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WEBHOOK_PATHS = new Set(["/api/payments/webhook"]);

function configuredOrigins() {
  const origins = new Set<string>();
  origins.add(`http://localhost:${env.PORT ?? "3000"}`);
  origins.add(`http://127.0.0.1:${env.PORT ?? "3000"}`);
  for (const raw of [env.ALLOWED_ORIGIN, env.BETTER_AUTH_URL]) {
    if (!raw) continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // Ignore invalid optional configuration; env validation handles required fields.
    }
  }
  return origins;
}

export const sameOriginWriteGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method) || WEBHOOK_PATHS.has(c.req.path)) {
    await next();
    return;
  }

  const allowedOrigins = configuredOrigins();
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");
  let sourceOrigin = origin ?? null;
  if (!sourceOrigin && referer) {
    try {
      sourceOrigin = new URL(referer).origin;
    } catch {
      sourceOrigin = null;
    }
  }

  if (sourceOrigin && allowedOrigins.has(sourceOrigin)) {
    await next();
    return;
  }

  if (sourceOrigin && env.NODE_ENV !== "production") {
    const host = new URL(sourceOrigin).hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      await next();
      return;
    }
  }

  const secFetchSite = c.req.header("sec-fetch-site");
  if (!sourceOrigin && (!secFetchSite || secFetchSite === "same-origin" || secFetchSite === "none")) {
    await next();
    return;
  }

  return c.json(
    { error: { message: "Cross-site write request rejected", code: "CSRF_REJECTED" } },
    403
  );
};

export function requireAppRedirectUrl(value: string): string {
  const url = new URL(value);
  const allowedOrigins = configuredOrigins();
  if (!allowedOrigins.has(url.origin)) {
    throw new Error("Redirect URL must use the configured app origin");
  }
  return url.toString();
}
