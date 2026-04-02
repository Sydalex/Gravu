# Framer Sync Boundary

This folder is the safe Framer/GitHub sync slice for Gravu.

Use the Framer GitHub plugin against:

- `framer-sync`

## Safe to edit here

- presentational landing page sections
- marketing-only layouts
- copy, spacing, typography, visual treatment
- static CTA blocks

## Keep outside Framer sync

- app routing
- auth flows
- upload / processing / result logic
- account, admin, marketplace, archive pages
- API calls, React Query, Zustand state, billing logic

## Current scope

The first production slice is:

- `framer-sync/landing`

Those components are consumed by:

- `webapp/src/pages/Landing.tsx`

## Import rule

Inside `framer-sync`, prefer these imports instead of direct app package imports:

- `@framer-runtime/motion`
- `@framer-runtime/router`

That keeps the top-level sync folder buildable from the Vite app.
