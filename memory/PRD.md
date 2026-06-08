# Ummah Cooperative — UI Overhaul PRD

## Original Problem Statement
> Overhaul the design of this web app. Make it look modern like a standard fintech classy website. Redesign the login page, member page, member profile page. Do not change Prisma schema, database tables, migration files, auth logic, API routes, env var names, or any data model / write logic. Only improve layout, typography, colors, spacing, cards, dashboard pages, homepage/register/login styling.

## User Choices
- **Aesthetic**: Premium dark fintech
- **Palette**: Pure neutral fintech (slate / navy / blue) — no Islamic motifs
- **Theme**: Both light and dark with toggle
- **Typography**: Standard sans (Inter) — audience 35+
- **Disliked**: Original sign-in layout

## Architecture (unchanged)
- Next.js 14 (App Router) + Prisma + Postgres + NextAuth (credentials, JWT)
- Frontend on port 3000, reverse-proxied at `:8001` (/api → Next.js) for platform ingress

## Design System (new)
- CSS variables driven theme (`globals.css`): `--bg`, `--surface`, `--surface-2`, `--border`, `--fg`, `--muted`, `--muted-fg`, `--accent` (+ light/dark)
- Tailwind `darkMode: 'class'`; semantic color tokens (`bg-surface`, `text-muted-foreground`, etc.)
- Inter (Google Fonts) via `next/font/google`
- Component primitives: `.card`, `.btn-primary`, `.btn-ghost`, `.input-base`, `.label-eyebrow`, `.pill`, `.grid-pattern`, `.glow-radial`
- `<ThemeToggle />` (uses `next-themes`) — class-based, persisted in localStorage

## Pages Redesigned
- `/` — homepage with hero, mock account-snapshot card, feature grid
- `/login` — split brand panel + form card with show/password toggle
- `/register` — 2-step grid (personal details + savings plan toggles) with live total
- `/dashboard` (member) — hero overview + metric grid + plan/loan/quick-actions + recent activity
- `/dashboard/profile` — identity strip + KPI cards + personal/bank cards with inline edit
- `/dashboard` (admin analytics) — refreshed hero + metric grid + snapshots + trend table
- `DashboardNav` — grouped sidebar with active rail, theme toggle, user summary

## Constraints Honored (no changes to)
- `prisma/schema.prisma`, migrations
- `src/lib/auth.ts`, `src/app/api/**` (routes/logic)
- `.env` variable names
- Prisma data models, server actions logic

## What's Implemented (Feb 22, 2026)
- ✅ Light + dark theme tokens with toggle in header & sidebar
- ✅ Redesigned: home, login, register, member dashboard, member profile, admin analytics, sidebar
- ✅ Reverse proxy at port 8001 so platform ingress can route /api/* to Next.js port 3000
- ✅ Postgres provisioned + `prisma db push` + seed run for live preview

## Backlog (P1 / P2)
- Polish remaining admin pages (`/dashboard/payments`, `/dashboard/loans`, `/dashboard/members`, `/dashboard/directory`, `/dashboard/transactions`, `/dashboard/finance-report`) to fully respect dark mode tokens
- Member sub-pages (`/dashboard/apply-loan`, `/dashboard/withdrawals`, `/dashboard/commodity`, `/dashboard/my-loans`, `/dashboard/history`) — same dark/light theming pass
- Optional: micro-animations on metric numbers (count-up) and skeleton loaders for slow DB queries
- Optional: empty-state illustrations for "No payments yet" / "No loans yet"

## Notes
- Reverse-proxy code lives in `/app/backend/server.py` (FastAPI + httpx forwarding to localhost:3000 while preserving multi-value Set-Cookie headers required by NextAuth).
- Helper `/app/frontend/package.json` exists only so the supervisor `frontend` program can launch `yarn dev` against the real Next.js app at `/app`.
