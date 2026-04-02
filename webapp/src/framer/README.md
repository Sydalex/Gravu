# Framer Sync Boundary

This folder is the safe Framer/GitHub sync slice for Gravu.

Sync this folder, not the whole `webapp/` directory.

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

## Recommended plugin target

Use your Framer GitHub code sync against:

- `webapp/src/framer`

The first production slice is:

- `webapp/src/framer/landing`

Those components are consumed by `/src/pages/Landing.tsx`.
