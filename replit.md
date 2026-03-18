# Workspace

## Overview

Body Composition Management System - Phase 1. A dark, mobile-first PWA (max 430px content width) for nutrition planning. Users sign up, complete a 3-page onboarding questionnaire, receive a server-side calculated daily nutrition plan (calories + macros), and use the Meal Builder to plan and track daily nutrition intake.

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

## Database Tables

Phase 1 (Drizzle ORM): users, user_profiles, plans
Phase 1 (raw SQL — Meal Builder): foods (113 USDA rows), user_meals, meal_portions, meal_schedule, meal_plan_entries, meal_plan_completions, meal_plan_exclusions, meal_portion_completions
Phase 1 (raw SQL — Exercise Builder): exercises (45 library + custom), user_workouts, workout_exercises, workout_schedule, food_stock
Phase 1 (raw SQL — Workout Plan): workout_plan_entries, workout_plan_completions, workout_plan_exclusions, workout_exercise_completions
Phase 2+ (schema only): weekly_checkins, meal_logs, workout_sessions, adjustment_logs

### Meal Builder tables (raw SQL, not in Drizzle schema)
- `foods` — USDA food items; serving_unit is "per_100g" or "per_piece"; includes columns: fdc_id, sugar_g, sodium_mg, gi_index, weigh_when, notes, dietary_tags, active
- `user_meals` — user-named meal containers (belongs to user)
- `meal_portions` — food + quantity_g entries inside a meal
- `meal_schedule` — maps meals to days-of-week (monday..sunday)
- `meal_plan_entries` — user-explicitly added meals to a specific date
- `meal_plan_completions` — tracks completed meals by date
- `meal_plan_exclusions` — excludes scheduled meals from specific dates
- `meal_portion_completions` — tracks completed meal portions by date

### Exercise Builder tables (raw SQL)
- `exercises` — 45 library exercises + custom exercises; fields: id, exercise_name, muscle_primary, exercise_type (strength/cardio), equipment, injury_contraindications (ARRAY), met_value (numeric), met_values (JSONB for cardio {light/moderate/vigorous}), form_cue (TEXT), is_custom (boolean), user_id (for custom exercises), active (boolean)
- `user_workouts` — user-created workout templates (name, notes)
- `workout_exercises` — exercise entries in a workout (sets, reps_min, reps_max, weight_kg, rest_seconds, duration_mins, speed_kmh, effort_level, estimated_calories)
- `workout_schedule` — maps workouts to days-of-week (monday..sunday)
- `food_stock` — shopping list tracking (food_id, user_id, weekly_quantity, notes)
- `workout_plan_entries` — user-explicitly added workouts to a specific date
- `workout_plan_completions` — tracks completed workouts by date
- `workout_plan_exclusions` — excludes scheduled workouts from specific dates
- `workout_exercise_completions` — tracks completed exercises within a workout by date

Macro calculation for portions:
- per_piece: multiplier = quantity_g / serving_weight_g
- per_100g: multiplier = quantity_g / 100

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
- `GET /api/foods/search?q=&group=` - Search food database (debounced, max 20 results)
- `GET /api/meals` - Get all user meals with portions + macro totals
- `POST /api/meals` - Create new meal (auto-names "Meal N")
- `PATCH /api/meals/:id` - Rename meal
- `DELETE /api/meals/:id` - Delete meal (cascades to portions + schedule)
- `POST /api/meals/:id/portions` - Add food portion to meal
- `PATCH /api/meals/:id/portions/:portionId` - Update portion quantity
- `DELETE /api/meals/:id/portions/:portionId` - Remove portion
- `POST /api/meals/:id/schedule` - Set scheduled days (replaces previous schedule)
- `GET /api/meals/day/:day` - Get meals scheduled for a specific day
- `GET /api/meals/daily-totals` - Today's totals, targets, progress %, warnings
- `GET /api/exercises?q=&muscle=&type=` - Search exercises (library + user custom); filters by name, muscle, type; returns only active and user-accessible exercises
- `POST /api/exercises` - Create custom exercise (requires auth; sets is_custom=TRUE, user_id=authenticated user; stores met_values JSONB for cardio)
- `POST /api/workouts` - Create new workout template
- `GET /api/workouts` - Get all user workouts with exercises + calorie totals
- `GET /api/workouts/day/:day` - Get workouts scheduled for a specific day
- `POST /api/workouts/:workoutId/exercises` - Add exercise to workout
- `PATCH /api/workouts/:workoutId/exercises/:exerciseId` - Update exercise in workout
- `DELETE /api/workouts/:workoutId/exercises/:exerciseId` - Remove exercise from workout
- `PATCH /api/workouts/:workoutId/exercises/:exerciseId/reorder` - Reorder exercise (move up/down)
- `POST /api/workouts/:workoutId/schedule` - Set scheduled days for workout
- `DELETE /api/workouts/:workoutId` - Delete workout
- `POST /api/shopping-list` - Create food stock entry
- `GET /api/shopping-list` - Get all food stock entries (shopping list)
- `PATCH /api/shopping-list/:foodId` - Update stock entry (quantity, notes)
- `DELETE /api/shopping-list/:foodId` - Remove stock entry

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
- `/dashboard` - Daily/Weekly toggle view; Daily: calorie target, calorie balance (consumed/burned/net), collapsible today's nutrition (calories/macros bars), collapsible today's training (planned/burned/remaining with burn progress), collapsible weight (started/current editable/target side-by-side), timeline; Weekly: calorie balance, total week nutrition, total week training, day-by-day chart
- `/profile/edit` - Edit profile metrics (triggers plan recalculation)
- `/nutrition/meals` - Meal Builder: create meals, add food portions, schedule by day, track daily progress; Shopping List with stock tracking
- `/training/builder` - Exercise Builder: create workout templates, add exercises (library or custom), schedule by day, track daily calorie burn; Custom Exercise creation form with strength/cardio-specific fields

## Dashboard Data Sync

- Dashboard refetches every 30 seconds (staleTime: 5s) to keep nutrition and training data in sync with meal plan and workout plan changes
- Data sources: `/api/dashboard/today?date=YYYY-MM-DD` and `/api/dashboard/weekly?week_start=YYYY-MM-DD`
- Nutrition data returns: 
  - consumed (from `meal_portion_completions` — actual food eaten)
  - planned (from `plans` table — user's active daily nutrition targets)
- Training data returns: planned (from workout schedule or plan entries) and burned (from completion records)
- Balance calculation returns:
  - tdee: daily calorie target from active plan
  - totalBurned: tdee + exercise burn (daily) or tdee × 7 + exercise burn (weekly)
  - balance: consumed - totalBurned (negative = deficit, positive = surplus)

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
