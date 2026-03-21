# Frontend Developer Guide

## Stack

- React 18 + Vite + TypeScript
- React Router v6 for routing
- React Query for server/async state
- Tailwind v3 + shadcn/ui for styling and components
- Framer Motion for animations
- Lucide React for icons
- Use `bun` (not `npm`) to install packages

## Structure

```
src/pages/        — Page components, manually registered in App.tsx
src/components/
  ui/             — shadcn/ui components (pre-built). Use these first.
src/hooks/        — Custom React hooks
src/lib/          — Utilities: utils.ts (cn helper for className merge)
```

Create small, focused components. Extract to separate files rather than long page files.

## TypeScript

- Explicit type annotations for `useState`: `useState<Type[]>([])` not `useState([])`
- Null/undefined handling: use `?.` and `??`
- Include ALL required properties when creating objects
- Use ternary operators instead of `&&` for conditional rendering inside JSX

## Adding a Route

1. Create a page component in `src/pages/` (e.g. `src/pages/Settings.tsx`)
2. Import it in `src/App.tsx`
3. Add a `<Route>` inside the `<Routes>` component
4. Add new routes **above** the catch-all `*` route

## State

- Use React Query for all server/async state
- Object API: `useQuery({ queryKey, queryFn })`
- Use `useMutation` for writes — no manual `setIsLoading` patterns
- For local/UI state use `useState` or Zustand

## API calls

Use the `api` helper from `src/lib/api.ts`:

```ts
import { api } from "@/lib/api";
const data = await api.get<MyType>("/api/your-endpoint");
```

API contracts are defined as Zod schemas in `../backend/src/types.ts`.
Import and validate responses using those schemas.

In development the frontend runs on port 8000 and the backend on port 3000.
`VITE_BACKEND_URL=http://localhost:3000` bridges the two.
In production (same origin), leave `VITE_BACKEND_URL` empty so relative `/api/…` URLs are used.

## Styling

- Use Tailwind utility classes
- `cn()` from `src/lib/utils.ts` for conditional className merging
- Use shadcn/ui components (`Button`, `Dialog`, etc.) — not raw HTML elements
- Forms: use `react-hook-form` + Zod schemas + shadcn/ui form components
- Animations: Tailwind transitions for simple hover/focus; Framer Motion for complex sequences

