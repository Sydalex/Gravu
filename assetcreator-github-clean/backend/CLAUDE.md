# Backend Developer Guide

## Stack

- Bun runtime, Hono web framework, Zod validation
- Prisma v6 + SQLite for data persistence
- Better Auth for authentication
- All API routes under `/api/` prefix

## Structure

```
src/index.ts     — App entry, CORS, middleware, route mounting
src/routes/      — Route handlers (trace, ai, convert, conversions, payments)
src/services/    — Sidecar launcher and vectorizer client
src/types.ts     — Shared Zod schemas (API contracts) — single source of truth
src/auth.ts      — Better Auth configuration
src/env.ts       — Zod environment variable validation
src/prisma.ts    — Prisma client
src/stripe.ts    — Stripe client (optional)
```

## Adding a Route

Create a file in `src/routes/` and mount it in `src/index.ts`:

```typescript
// src/routes/todos.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const todosRouter = new Hono();

todosRouter.get("/", (c) => c.json({ todos: [] }));

todosRouter.post(
  "/",
  zValidator("json", z.object({ title: z.string() })),
  (c) => {
    const { title } = c.req.valid("json");
    return c.json({ todo: { id: "1", title } });
  }
);

export { todosRouter };
```

Mount in `src/index.ts`:
```typescript
import { todosRouter } from "./routes/todos";
app.route("/api/todos", todosRouter);
```

## Shared Types

Define all API request/response contracts in `src/types.ts` as Zod schemas.
Both the backend routes and the frontend import from this file.

## Testing Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Authenticated request (include session cookie)
curl -b cookies.txt http://localhost:3000/api/conversions
```

## Database

SQLite with Prisma. Schema lives in `prisma/schema.prisma`.

```bash
bunx prisma db push       # sync schema to DB (dev)
bunx prisma migrate dev   # create + apply a migration
bunx prisma studio        # open Prisma Studio GUI
```
