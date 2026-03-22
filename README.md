# Gravu

A web application for converting photos into CAD-ready vector assets. Convert photos into clean architectural line drawings and export as DXF/SVG for AutoCAD, SketchUp, and Illustrator.

All source code, documentation, and deployment files live in the [`assetcreator-github-clean/`](./assetcreator-github-clean/) directory.

---

## Quick Start — Docker Compose (Staging / Self-Hosted)

### 1. Copy the environment file and fill in the required values

```bash
cd assetcreator-github-clean
cp .env.staging.example .env.staging
# Edit .env.staging — at minimum set PUBLIC_URL and BETTER_AUTH_SECRET
```

### 2. Start all services

```bash
docker compose --env-file .env.staging up -d --build
```

### `docker-compose.yml`

The compose file is at [`assetcreator-github-clean/docker-compose.yml`](./assetcreator-github-clean/docker-compose.yml).  
Copy it below:

```yaml
# Staging docker-compose for Gravu / AssetCreator
# Designed for self-hosted deployment on Coolify (or any Docker host).
#
# Services:
#   frontend   — React SPA served by nginx, proxies /api/ to the backend
#   backend    — Bun + Hono API with Prisma (SQLite stored in a Docker volume)
#   vectorizer — Python FastAPI centerline vectorization sidecar
#
# Quick start:
#   cp .env.staging.example .env.staging
#   # fill in the required values in .env.staging
#   docker compose --env-file .env.staging up -d --build

services:
  # ── Frontend ──────────────────────────────────────────────────────────────
  frontend:
    build:
      context: ./webapp
      dockerfile: Dockerfile
    restart: unless-stopped
    # Expose port 80 to the internal Docker network only.
    # Coolify's Traefik reverse proxy routes external HTTPS traffic here;
    # do NOT bind a host port (would conflict with Traefik on port 80/443).
    expose:
      - "80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app

  # ── Backend API ───────────────────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "3000"
      # SQLite file in the persistent volume mounted at /app/data
      DATABASE_URL: "file:/app/data/gravu.db"
      # Python vectorizer runs as a separate container on the internal network
      CENTERLINE_VECTORIZER_URL: "http://vectorizer:8000"
      # --- Required secrets (set in .env.staging or Coolify environment) ---
      BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET}"
      # Public URL the browser reaches the app on (used by Better Auth for
      # callback/redirect URLs and by the backend for CORS).
      # With the nginx proxy both URLs are the same origin.
      BETTER_AUTH_URL: "${PUBLIC_URL}"
      ALLOWED_ORIGIN: "${PUBLIC_URL}"
      # --- Optional: Gemini AI (required for the full AI pipeline) ----------
      GEMINI_API_KEY: "${GEMINI_API_KEY:-}"
      # --- Optional: SMTP (required for email OTP delivery) -----------------
      SMTP_HOST: "${SMTP_HOST:-}"
      SMTP_PORT: "${SMTP_PORT:-587}"
      SMTP_USER: "${SMTP_USER:-}"
      SMTP_PASS: "${SMTP_PASS:-}"
      SMTP_FROM: "${SMTP_FROM:-noreply@example.com}"
      # --- Optional: Stripe (required for billing features) -----------------
      STRIPE_SECRET: "${STRIPE_SECRET:-}"
      STRIPE_WEBHOOK_SECRET: "${STRIPE_WEBHOOK_SECRET:-}"
      STRIPE_PRO_PRICE_ID: "${STRIPE_PRO_PRICE_ID:-price_placeholder_pro}"
    volumes:
      # Persist the SQLite database across container restarts
      - sqlite_data:/app/data
    healthcheck:
      test:
        - "CMD"
        - "bun"
        - "--eval"
        - "const r = await fetch('http://localhost:3000/health'); process.exit(r.ok ? 0 : 1)"
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 30s
    depends_on:
      vectorizer:
        condition: service_healthy
    networks:
      - app

  # ── Python Vectorizer Sidecar ─────────────────────────────────────────────
  vectorizer:
    build:
      context: ./backend/vendor/raster-dxf-centerline
      dockerfile: Dockerfile
    restart: unless-stopped
    healthcheck:
      test:
        - "CMD"
        - "python3"
        - "-c"
        - "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 30s
    networks:
      - app

# ── Volumes ───────────────────────────────────────────────────────────────────
volumes:
  sqlite_data:

# ── Networks ──────────────────────────────────────────────────────────────────
networks:
  app:
    driver: bridge
```

### Required environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `PUBLIC_URL` | ✅ | Public HTTPS URL, e.g. `https://gravu.example.com` |
| `BETTER_AUTH_SECRET` | ✅ | Generate with: `openssl rand -hex 32` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Recommended | Without these, OTP codes are printed to logs only |
| `GEMINI_API_KEY` | Optional | Required for the full AI pipeline |
| `STRIPE_SECRET` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | Optional | Billing endpoints return 503 when not set |

---

For full documentation see [`assetcreator-github-clean/README.md`](./assetcreator-github-clean/README.md).