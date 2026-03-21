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
assetcreator-github-clean/
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

## Before Self-Hosting in Production

- [ ] Set `ALLOWED_ORIGIN` to your production frontend URL
- [ ] Set `SMTP_*` variables for real email delivery (OTP emails)
- [ ] Set `STRIPE_*` variables if you want billing enabled
- [ ] Rotate `BETTER_AUTH_SECRET` and any other secrets
- [ ] Decide: keep SQLite or migrate to PostgreSQL (update `DATABASE_URL` and `prisma/schema.prisma` provider)
- [ ] Serve behind a TLS-terminating reverse proxy (nginx, Caddy) — auth cookies require HTTPS in production
- [ ] Verify the Python sidecar starts correctly on your server (`python3`, `pip`, `bash` must be available)
- [ ] Confirm `DATABASE_URL` points to a persistent path (not a container tmpfs)

