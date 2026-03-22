# AssetCreator — CAD Vector Generator

A web application for converting photos into CAD-ready vector assets. Convert photos into clean architectural line drawings and export as DXF/SVG for AutoCAD, SketchUp, and Illustrator.

---

## Architecture

| Component | Technology | Port |
|-----------|-----------|------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind + shadcn/ui | 8000 |
| **Backend API** | Bun + Hono + Prisma (SQLite) + Better Auth | 3000 |
| **Python sidecar** | FastAPI + OpenCV + scikit-image + ezdxf | 8001 |

All image and vector data is stored as base64 in the SQLite database — no external object storage required.

---

## Features

- **Photo to Vector (Full AI Pipeline)** — upload a photo → Gemini detects subjects → select subjects and view angle → AI generates architectural linework → export SVG/DXF/PNG
- **Vectorize Linework Only** — upload an existing line drawing → local centerline vectorizer → export SVG/DXF/PNG
- Email + password auth and email OTP fallback (Better Auth)
- Stripe subscription and credits system (optional)
- "Convert once, store forever" — results are cached in the database

---

## Local Development

### Requirements

- [Bun](https://bun.sh) (runtime for backend and frontend)
- Python 3.9+ with `pip` and `bash` (for the Python sidecar)

### 1. Copy environment files

```bash
cp backend/.env.example backend/.env
cp webapp/.env.example webapp/.env
```

Edit `backend/.env` and set at minimum:

| Variable | Required | Notes |
|----------|----------|-------|
| `BETTER_AUTH_SECRET` | ✅ | Any long random string |
| `BETTER_AUTH_URL` | For production | Base URL of the backend (e.g. `https://api.example.com`); defaults to `http://localhost:3000` in dev |
| `GEMINI_API_KEY` | For AI routes | Google AI Studio key |
| `SMTP_HOST` | For email OTP | If blank, OTP is printed to server console |
| `STRIPE_SECRET` | For billing | If blank, billing endpoints return 503 |
| `ALLOWED_ORIGIN` | For production | Your frontend URL (e.g. `https://app.example.com`) |

### 2. Install dependencies

```bash
cd backend && bun install
cd ../webapp && bun install
```

### 3. Set up the database

```bash
cd backend
bunx prisma migrate deploy   # apply migrations
# or for a fresh dev DB:
bunx prisma db push
```

### 4. Start the backend (Terminal 1)

```bash
cd backend
bun run dev
```

This script:
1. Creates a Python virtualenv under `backend/vendor/raster-dxf-centerline/.venv`
2. Installs Python dependencies from `requirements.txt`
3. Starts the FastAPI sidecar on `http://127.0.0.1:8001`
4. Waits for `/health` to respond
5. Starts the Bun backend with hot reload on port 3000

### 5. Start the frontend (Terminal 2)

```bash
cd webapp
bun run dev
```

Vite dev server runs on `http://localhost:8000`.

---

## Environment Variables

### `backend/.env`

```
PORT=3000
NODE_ENV=development

# Your production frontend URL (leave blank for localhost-only dev)
ALLOWED_ORIGIN=

# Base URL of the backend – used by Better Auth for callback/redirect URLs
# Leave blank for localhost-only dev (defaults to http://localhost:3000)
BETTER_AUTH_URL=

GEMINI_API_KEY=
CENTERLINE_VECTORIZER_URL=http://127.0.0.1:8001

DATABASE_URL=file:./dev.db

BETTER_AUTH_SECRET=replace-with-a-long-random-secret

# SMTP for email OTP – if not set, OTP is logged to console
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# Stripe – optional; billing endpoints return 503 when not set
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=price_placeholder_pro
```

### `webapp/.env`

```
VITE_BACKEND_URL=http://localhost:3000
```

> In production where the frontend is served from the same origin as the backend, leave `VITE_BACKEND_URL` empty so the frontend uses relative `/api/…` URLs.

---

## API Endpoints

### Auth (`/api/auth/*`)
Handled by Better Auth — sign-up, sign-in, OTP, session, logout.

### Image Processing
- `POST /api/trace/upload` — resize & convert uploaded image to PNG
- `POST /api/trace/vectorize` — trace image to SVG (potrace)
- `POST /api/trace/export-dxf` — SVG → DXF

### AI (Gemini)
- `POST /api/ai/detect-subjects` — detect objects in image
- `POST /api/ai/generate-linework` — convert photo to architectural linework

### Conversion
- `POST /api/convert/dxf-to-svg` — DXF → SVG
- `POST /api/convert/svg-to-dxf` — SVG → DXF (local)
- `POST /api/convert/vectorise-ai` — production DXF via Python sidecar
- `POST /api/convert/vectorise` — VTracer vectorization (experimental)
- `POST /api/convert/compose` — combine images side-by-side

### Conversions (history)
- `GET /api/conversions` — list saved conversions
- `GET /api/conversions/:id` — conversion detail
- `POST /api/conversions` — save new conversion
- `PATCH /api/conversions/:id/assets/:assetId` — update asset

### Payments (requires `STRIPE_SECRET`)
- `GET /api/payments/subscription` — subscription status & credits
- `POST /api/payments/checkout` — create Stripe checkout session
- `POST /api/payments/portal` — create Stripe billing portal link
- `POST /api/payments/webhook` — Stripe webhook handler

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.ts            # App entry point, CORS, middleware
│   │   ├── auth.ts             # Better Auth + email OTP
│   │   ├── env.ts              # Zod env validation
│   │   ├── stripe.ts           # Stripe client (optional)
│   │   ├── prisma.ts           # Prisma client
│   │   ├── types.ts            # Shared Zod schemas (API contracts)
│   │   ├── routes/             # API route handlers
│   │   └── services/           # Sidecar launcher and vectorizer client
│   ├── vendor/
│   │   └── raster-dxf-centerline/  # Bundled Python vectorizer
│   ├── prisma/schema.prisma    # SQLite schema
│   ├── scripts/                # Startup shell scripts
│   ├── .env.example
│   └── package.json
├── webapp/
│   ├── src/
│   │   ├── pages/              # 14 page components
│   │   ├── components/         # Shared UI components
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # Utilities
│   ├── vite.config.ts
│   ├── .env.example
│   └── package.json
├── CLAUDE.md                   # Developer architecture notes
└── README.md                   # This file
```

---

## Local Verification

The following checks were confirmed to work with a fresh clone and default `.env.example` values:

| Check | Result |
|-------|--------|
| `bun install` (backend) | ✅ 159 packages |
| `bun install` (webapp) | ✅ 382 packages |
| `bunx prisma db push` | ✅ SQLite DB created |
| Backend starts (`bun run src/index.ts`) | ✅ No Vibecode services required |
| Vite dev server (`bun run dev` in webapp) | ✅ No Vibecode Vite plugin — uses `@vitejs/plugin-react-swc` |
| Auth — sign-up, sign-in, session | ✅ All work with Better Auth + SQLite |
| Python sidecar starts, `/health` responds | ✅ FastAPI + uvicorn on port 8001 |
| `POST /api/trace/upload` (image upload) | ✅ PNG resized and returned as base64 |
| `POST /api/trace/vectorize` (image → SVG) | ✅ potrace traces to SVG |
| `POST /api/trace/export-dxf` (SVG → DXF) | ✅ dxf-writer produces valid DXF |
| `POST /api/convert/vectorise-ai` (centerline sidecar) | ✅ Python pipeline produces DXF |

### Remaining blockers for self-hosting

None that block local development. The following are production-only requirements:

- **Email OTP in production** — set `SMTP_HOST` and friends; without it OTP codes are only logged to the server console (fine for dev, unusable for end users).
- **HTTPS + reverse proxy** — `better-auth` sets `secure: true` cookies when `NODE_ENV=production`. You must serve the app over HTTPS (nginx, Caddy, etc.) or cookies will be silently rejected by browsers.
- **`BETTER_AUTH_URL`** — set to the public backend URL (e.g. `https://api.example.com`) so Better Auth can construct correct callback/redirect URLs. In development the default of `http://localhost:3000` is used automatically.
- **`ALLOWED_ORIGIN`** — set to the public frontend URL so CORS allows cross-origin cookie delivery.
- **Persistent `DATABASE_URL`** — make sure `dev.db` (or the configured SQLite path) is on persistent storage in a container/VM deployment.
- **Gemini API key** — `GEMINI_API_KEY` is required only for the AI pipeline (subject detection, linework generation). All local vectorization works without it.
- **Stripe** — `STRIPE_SECRET` / `STRIPE_WEBHOOK_SECRET` are required only for billing. Endpoints return HTTP 503 when not configured.

---

## Staging Deployment (Coolify / Docker)

### Architecture

Three Docker containers are orchestrated by `docker-compose.yml`:

| Service | Image | Internal port | Role |
|---------|-------|--------------|------|
| `frontend` | nginx (built from `webapp/`) | 80 | Serves the React SPA; proxies `/api/*` to the backend |
| `backend` | oven/bun (built from `backend/`) | 3000 | Bun + Hono REST API + Prisma |
| `vectorizer` | python:3.12-slim (built from `backend/vendor/raster-dxf-centerline/`) | 8000 | FastAPI centerline vectorization sidecar |

**SQLite is kept for staging.** All image and vector data is stored as base64 strings, so the database never grows extremely large for typical usage. The file is persisted in a named Docker volume (`sqlite_data`). Migrate to PostgreSQL only when you need multiple backend replicas or horizontal scaling.

The nginx container is the **only public-facing service** on port 80. Coolify's Traefik reverse proxy terminates TLS in front of it. The backend and vectorizer containers are on an internal Docker network only.

Because nginx proxies `/api/` requests from the frontend to the backend (same public origin), there is no cross-origin cookie issue and `VITE_BACKEND_URL` is left empty at build time.

### Required env vars for staging

| Variable | Required | Notes |
|----------|----------|-------|
| `PUBLIC_URL` | ✅ | Public HTTPS URL, e.g. `https://gravu.example.com` — used for Better Auth callbacks and CORS |
| `BETTER_AUTH_SECRET` | ✅ | Any long random string (`openssl rand -hex 32`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Recommended | Without these, OTP codes are printed to the backend logs only |
| `GEMINI_API_KEY` | Optional | Required only for the full AI pipeline (subject detection + linework). Vectorize-only flow works without it |
| `STRIPE_SECRET` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | Optional | Billing endpoints return HTTP 503 when not set |

### Deploy on Coolify

1. **Add a new Resource → Docker Compose** and point it at this repository.
2. Set the compose file path to `docker-compose.yml`.
3. In the Coolify environment variables panel, set at minimum:
   ```
   PUBLIC_URL=https://your-app.example.com
   BETTER_AUTH_SECRET=<generate with: openssl rand -hex 32>
   ```
   Add SMTP and Gemini variables as needed.
4. Coolify will build all three images and start the services in dependency order.
5. Expose the `frontend` service (port 80) through Coolify's built-in Traefik proxy for HTTPS.

### Deploy manually with Docker Compose

```bash
cp .env.staging.example .env.staging
# Edit .env.staging and fill in the required values
docker compose --env-file .env.staging up -d --build
```

### Staging deployment checklist

- [ ] `PUBLIC_URL` set to the HTTPS URL the app will be served on
- [ ] `BETTER_AUTH_SECRET` rotated to a fresh random value
- [ ] SMTP credentials set (or accept that OTP codes only appear in logs)
- [ ] `GEMINI_API_KEY` set if the AI pipeline is needed
- [ ] `STRIPE_*` set if billing is required; otherwise leave blank
- [ ] `sqlite_data` Docker volume confirmed on persistent host storage (not tmpfs)
- [ ] Coolify/Traefik TLS certificate issued for the public domain

### Remaining blockers before first deployment

| Blocker | Severity | Notes |
|---------|----------|-------|
| `BETTER_AUTH_SECRET` not set | 🔴 Blocks start | Backend exits on startup without it |
| No HTTPS / TLS | 🔴 Blocks auth | Better Auth sets `secure` cookies in `NODE_ENV=production`; must be served over HTTPS |
| `PUBLIC_URL` not set | 🔴 Blocks auth | CORS and Better Auth callbacks will fail |
| No SMTP config | 🟡 Degrades UX | OTP codes logged to console only — fine for private staging, broken for real users |
| No `GEMINI_API_KEY` | 🟡 Partial feature | "Photo → Vector" AI flow disabled; "Vectorize Linework" still works |
| No Stripe config | 🟢 Optional | Billing endpoints return 503; rest of app is unaffected |

---

## Before Self-Hosting in Production

- [ ] Set `PUBLIC_URL` (or `ALLOWED_ORIGIN` + `BETTER_AUTH_URL`) to your production URL
- [ ] Set `SMTP_*` variables for real email delivery (OTP emails)
- [ ] Set `STRIPE_*` variables if you want billing enabled
- [ ] Rotate `BETTER_AUTH_SECRET` and any other secrets
- [ ] Decide: keep SQLite or migrate to PostgreSQL (update `DATABASE_URL` and `prisma/schema.prisma` provider)
- [ ] Serve behind a TLS-terminating reverse proxy (nginx, Caddy, or Coolify's Traefik) — auth cookies require HTTPS in production
- [ ] Confirm `DATABASE_URL` points to a persistent path (not a container tmpfs)

