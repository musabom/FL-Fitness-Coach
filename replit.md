# Workspace

## Overview

Body Composition Management System - Phase 1. A dark, mobile-first PWA (max 430px content width) for nutrition plan calculation. Users sign up, complete an 11-step onboarding questionnaire, and receive a server-side calculated daily nutrition plan (calories + macros).

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS v4, Wouter routing, React Query, Framer Motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Session-based (express-session + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for API server)

## Design System

- Background: #0F0F0F (dark)
- Card: #1A1A1A
- Primary/Accent: #0D9E75 (teal)
- Color signals: green=#0D9E75 (positive), amber=#F59E0B (warning), red=#EF4444 (alert)
- Font: Inter
- Mobile-first, max 430px content width
- Min 44px tap targets
- No horizontal scroll

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080, path /api)
│   ├── web/                # React + Vite frontend (path /)
│   └── mockup-sandbox/     # Component preview server
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks + customFetch
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Tables (7 total)

Phase 1 (active): users, user_profiles, plans
Phase 2+ (schema only): weekly_checkins, meal_logs, workout_sessions, adjustment_logs

## API Routes

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user (returns hasProfile flag)
- `POST /api/onboarding` - Complete onboarding questionnaire + calculate initial plan
- `GET /api/profile` - Get user profile
- `PATCH /api/profile` - Update profile (triggers plan recalculation)
- `GET /api/plan/active` - Get active nutrition plan
- `POST /api/goals/available` - Filter available goal modes by weight gap (GUARD-03)

## Auth Pattern

- Session-based auth using express-session with bcryptjs password hashing
- Frontend uses custom `useAuth` hook with React Query (key: `["auth", "me"]`)
- 401 errors return `null` user (not error state) to avoid infinite refetch loops
- `credentials: "include"` added to customFetch for cookie support
- Session secret required in production via `SESSION_SECRET` env var
- Cookie: httpOnly, sameSite: lax, secure in production

## Plan Calculation

- Plans are NEVER edited — always create new plan record with version+1, set old plan inactive
- Trigger stored as "onboarding" / "manual_edit" / "weight_update"
- Formulas: BMR (Mifflin-St Jeor), TDEE (activity multiplier), body fat estimate, macro split by goal mode
- GUARD-03: Goal mode options filtered (hidden) based on weight gap

## Frontend Pages

- `/login` - Login form
- `/signup` - Registration form
- `/onboarding` - 11-step questionnaire (height, weight, target weight, age, gender, goal, activity, training days, location, dietary prefs, injuries)
- `/dashboard` - Calorie target, macros grid, weight info, timeline estimate, plan summary
- `/profile/edit` - Edit profile metrics (triggers plan recalculation)

## Development

- Vite proxies `/api` requests to `http://localhost:8080` in development
- API server runs on PORT from env (default 8080)
- Web frontend runs on PORT from env (default 22333)
- `pnpm --filter @workspace/api-spec run codegen` to regenerate API client
- `pnpm --filter @workspace/db run push` to push schema changes

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` during typecheck
- **Project references** — when package A depends on B, A's `tsconfig.json` must list B in references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`, plan calculation in `src/lib/plan-calculator.ts`.

### `artifacts/web` (`@workspace/web`)

React + Vite frontend. Pages in `src/pages/`, hooks in `src/hooks/`, UI components in `src/components/ui/`.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks, fetch client, and exported `customFetch`/`ApiError`.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.
