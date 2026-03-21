# Developer Guide

This file captures architecture decisions and conventions that apply across the whole project.

## Project layout

```
assetcreator-github-clean/
├── backend/        Bun + Hono API server (port 3000)
├── webapp/         React 18 + Vite frontend (port 8000)
└── README.md       Setup and local development instructions
```

## Key conventions

- **Shared API contracts** – All request/response Zod schemas live in `backend/src/types.ts`.
  Both the backend routes and the frontend import from that file; it is the single source of truth.

- **Relative vs absolute URLs** – In production the webapp is served from the same origin as the
  backend (e.g. `/api/…`), so `VITE_BACKEND_URL` should be left empty or omitted.
  Set it only for local cross-origin development (`http://localhost:3000`).

- **Auth base URL** – Better Auth derives its base URL per-request from reverse-proxy headers
  (`X-Forwarded-Host` / `X-Forwarded-Proto`) via `trustedProxyHeaders: true`.
  Do **not** hard-code `baseURL` in the `betterAuth()` config.

- **Auth client** – The webapp auth client should use:
  ```ts
  baseURL: import.meta.env.VITE_BACKEND_URL || undefined
  ```
  The API helper should use:
  ```ts
  import.meta.env.VITE_BACKEND_URL || ""  // empty string → relative URLs in production
  ```

## Adding a new endpoint

1. Define Zod schemas in `backend/src/types.ts`
2. Implement the route in the appropriate `backend/src/routes/*.ts` file
3. Import and use those schemas in the React page/component

## Python vectorizer sidecar

The centerline vectorizer lives in `backend/vendor/raster-dxf-centerline/`.
`bun run dev` (and `bun run start`) automatically creates a virtualenv, installs
`requirements.txt`, and starts the FastAPI server on `http://127.0.0.1:8001` before
booting the Bun backend.

See `backend/scripts/dev-with-centerline.sh` for the full startup logic.

