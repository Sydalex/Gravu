# AssetCreator - CAD Vector Generator

A web application for converting photos into CAD-ready vector assets. Convert photos into clean architectural line drawings and export as DXF/SVG for AutoCAD, SketchUp, and Illustrator.

## Features

### Authentication
- Email + Password login and registration via Better Auth
- Email OTP fallback ("Use email code instead") for passwordless access
- Protected routes - must be signed in to use the app
- Session management with secure cookies (persistent login)

### Two Flow Types

1. **Photo to Vector (Full AI Pipeline)**
   - Upload a photo
   - AI detects subjects using Gemini
   - Select which subjects to extract
   - Choose output view angle (perspective, top, side, custom)
   - Choose output mode:
     - **Illustration** (default) — faithful contour tracing of the original image
     - **Vectorworks Centerline** — simplified architectural linework optimized for single-line CAD vectorization
   - AI converts to architectural linework
   - Export as SVG, DXF, or PNG

2. **Vectorize Linework Only**
   - Upload an existing line drawing
   - Local centerline vectorizer converts to high-quality CAD vectors
   - Export as SVG, DXF, or PNG

### Vectorization
- Uses a bundled local Python service (`raster-dxf-centerline`) for centerline DXF generation
- DXF is the primary output; SVG is derived from DXF via backend conversion (free)
- **Convert once, store forever**: vectorisation results (SVG/DXF) are saved to the database after the first conversion. Subsequent access loads from DB — no repeat API calls.
- Results are cached in-memory per session and persisted to DB on first convert

### Export Formats
- **PNG** - Direct download of processed images
- **SVG** - Converted from DXF via backend (free)
- **DXF** - For AutoCAD, SketchUp (1 credit per vectorization)
- **Combined Export** - All subjects in one file (1 credit total)

## Tech Stack

### Frontend (`/webapp`)
- React 18 + Vite
- TypeScript
- Tailwind CSS + shadcn/ui
- Framer Motion (animations)
- Zustand (state management)
- React Query (server state)
- Better Auth (email + password + OTP)
- Lucide React (icons)

### Backend (`/backend`)
- Bun runtime
- Hono web framework
- Prisma v6 (SQLite database)
- Better Auth (email + password + OTP)
- Sharp (image processing)
- DXF-writer (DXF export)
- Zod (validation)

## API Endpoints

### Auth
- `POST /api/auth/sign-in/email` - Sign in with email + password
- `POST /api/auth/sign-up/email` - Register with email + password
- `POST /api/auth/email-otp/send-verification-otp` - Send OTP (passwordless fallback)
- `POST /api/auth/sign-in/email-otp` - Verify OTP and sign in
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/get-session` - Get current session

### Image Processing
- `POST /api/trace/upload` - Upload and process image (resize, convert to PNG)
- `POST /api/trace/vectorize` - Trace image to SVG using potrace
- `POST /api/trace/export-dxf` - Convert SVG to DXF format

### AI (Gemini)
- `POST /api/ai/detect-subjects` - Detect subjects in image using Gemini 2.5 Flash
- `POST /api/ai/generate-linework` - Convert photo to architectural linework

### Conversion
- `POST /api/convert/dxf-to-svg` - Convert DXF content to SVG
- `POST /api/convert/compose` - Combine multiple images side-by-side
- `POST /api/convert/vectorise` - Local VTracer vectorization (free, experimental)
- `POST /api/convert/vectorise-ai` - Production DXF output via local raster-dxf-centerline service
- `POST /api/convert/svg-to-dxf` - Convert SVG to DXF (free, local)

## Environment Variables

### Backend
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - SQLite database path (default: file:./dev.db)
- `BETTER_AUTH_SECRET` - Auth secret key (auto-generated)
- `GEMINI_API_KEY` - Google Gemini API key (required for AI features)
- `VECTORISER_AI_API_ID` - Vectoriser.AI API ID (legacy, only used in comparison routes)
- `VECTORISER_AI_API_SECRET` - Vectoriser.AI API secret (legacy, only used in comparison routes)
- `CENTERLINE_VECTORIZER_URL` - Base URL for the local Python raster-to-DXF centerline service (default: `http://127.0.0.1:8001`)

### Backend startup

The backend is responsible for starting the local Python centerline vectorizer service as part of its normal startup:

- `bun run start` (or the equivalent process manager command) now runs:
  - `backend/scripts/start-with-centerline.sh`
  - This script:
    - Creates a virtualenv under `backend/vendor/raster-dxf-centerline/.venv` (if missing)
    - Installs Python dependencies from `backend/vendor/raster-dxf-centerline/requirements.txt`
    - Starts `uvicorn app.main:app --host 127.0.0.1 --port 8001`
    - Waits for `http://127.0.0.1:8001/health` to report healthy
    - Then `exec`s the Bun backend (`bun run src/index.ts`)

Development:

- `bun run dev` runs `backend/scripts/dev-with-centerline.sh`, which behaves the same but runs the Bun backend with hot reload (`bun run --hot src/index.ts`).

Assumptions:

- The deployment environment can run `python3`, `pip`, and `bash`.
- The `raster-dxf-centerline` project has been copied into `backend/vendor/raster-dxf-centerline/`.
- The environment can host both the Python service and the Bun backend on the same machine.

### Frontend
- `VITE_BACKEND_URL` - Backend API URL

## Pages

- `/login` - Email + password login (guest only)
- `/register` - Create a new account (guest only)
- `/verify-otp` - OTP verification for passwordless login (guest only)
- `/` - Home - Flow selection (protected)
- `/upload` - Image upload with drag-and-drop (protected)
- `/selection` - Subject detection and processing options (protected)
- `/processing` - Loading/processing screen with progress (protected)
- `/result` - Result viewer with export options (protected)

## GitHub-Ready Import Notes

This cleaned copy is prepared for GitHub import:

- local `.env` files were removed
- local SQLite database files were removed
- Python cache files and macOS `._*` junk files were removed
- root and package-level `.gitignore` rules were tightened
- `.env.example` files were added for backend and webapp

Before pushing this repo anywhere:

1. Create new local env files from the examples:
   - `backend/.env.example` -> `backend/.env`
   - `webapp/.env.example` -> `webapp/.env`
2. Fill in real secrets locally
3. Rotate any secrets that were present in earlier exported zips

## Local Development Setup

### Requirements
- Bun
- Python 3
- pip
- bash

### 1. Backend env
Copy:

```bash
cp backend/.env.example backend/.env
```

Set at minimum:
- `BETTER_AUTH_SECRET`
- `GEMINI_API_KEY` if using AI routes
- `STRIPE_SECRET` if testing billing
- `CENTERLINE_VECTORIZER_URL` (default local value is already in the example)

### 2. Frontend env
Copy:

```bash
cp webapp/.env.example webapp/.env
```

Adjust:
- `VITE_BACKEND_URL=http://localhost:3000`

### 3. Install dependencies

Backend:

```bash
cd backend
bun install
```

Frontend:

```bash
cd ../webapp
bun install
```

### 4. Run the backend

```bash
cd ../backend
bun run dev
```

This starts:
- the Python centerline vectorizer sidecar
- the Bun backend with hot reload

### 5. Run the frontend

In a second terminal:

```bash
cd /path/to/repo/webapp
bun run dev
```

## Git Initialization

From the cleaned repo root:

```bash
git init
git add .
git commit -m "Initial import"
```

## Push To GitHub

Create an empty repo on GitHub first, then run:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

If using SSH:

```bash
git branch -M main
git remote add origin git@github.com:YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## What Still Needs Attention Before Production

- replace any remaining Vibecode-specific dependencies if they are no longer needed
- rotate all secrets that appeared in previous exports
- confirm where uploads and generated files should live in production
- decide whether to keep SQLite first or migrate to Postgres
- verify auth, billing, and vectorizer startup on a self-hosted server
