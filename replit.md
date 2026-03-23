# Workspace

## Overview

This project is a Body Composition Management System designed as a dark, mobile-first Progressive Web App (PWA). It features a 3-role system: Members receive personalized nutrition/workout plans and coach integration; Coaches manage assigned clients and their plans; Admins oversee users, roles, assignments, and the content library for food and exercises. The system aims to provide comprehensive tools for body composition management, focusing on personalized plans and seamless interaction between members, coaches, and administrators.

The project utilizes a pnpm workspace monorepo structure with TypeScript, where each package manages its own dependencies.

## User Preferences

I prefer iterative development.

## System Architecture

The system is built as a pnpm workspace monorepo.

**Frontend:**
- **Framework:** React with Vite
- **Styling:** TailwindCSS v4
- **Routing:** Wouter
- **State Management/Data Fetching:** React Query
- **Animations:** Framer Motion
- **UI/UX:** Mobile-first design with a maximum content width of 430px.
  - **Color Palette:**
    - Background: `#0F0F0F` (dark)
    - Card: `#1A1A1A`
    - Primary/Accent: `#0D9E75` (teal)
    - Signal Colors: Green (`#0D9E75` for positive), Amber (`#F59E0B` for warning), Red (`#EF4444` for alert)
  - **Font:** Inter
  - **Interaction:** Minimum 44px tap targets, no horizontal scroll.

**Backend:**
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Session-based using `express-session` and `bcryptjs` for password hashing.
- **Validation:** Zod (`zod/v4`) integrated with `drizzle-zod`.
- **API Definition:** OpenAPI spec with Orval for client code generation.
- **Build Tool:** esbuild (for CJS bundle of API server).

**Core Features & Logic:**
- **3-Role System:** `member`, `coach`, `admin` roles control access and functionality.
  - **Role-based Routing:** Guards redirect users based on their role (`/admin`, `/coach/clients`, `/dashboard`).
  - **Coach/Admin Client Context:** Allows coaches and admins to view client data by appending `?clientId=X` to API requests, with backend middleware resolving `res.locals.userId` accordingly.
  - **Backend Role Middleware:** Enforces access control (`requireAdmin`, `requireCoachOrAdmin`, `resolveTargetUserId`).
- **Authentication:** Session-based with httpOnly cookies, `useAuth` hook on frontend, and `credentials: "include"` for cookie support.
- **Plan Calculation:**
  - Plans are immutable; updates create new versions.
  - Triggers for recalculation include onboarding, manual edits, and weight updates.
  - Formulas used: BMR (Mifflin-St Jeor), TDEE, body fat estimation, and macro split based on goal mode.
  - Goal mode options are dynamically filtered based on weight gap (GUARD-03).
- **Dashboard Data Sync:** Refreshes every 30 seconds to show up-to-date nutrition and training data, including calorie targets, balance, compliance, and progress.

**Monorepo Structure:**
- `artifacts/api-server`: Express API server.
- `artifacts/web`: React + Vite frontend.
- `artifacts/mockup-sandbox`: Component preview server.
- `lib/api-spec`: OpenAPI specification and Orval configuration.
- `lib/api-client-react`: Generated React Query hooks and custom fetch client.
- `lib/api-zod`: Generated Zod schemas from OpenAPI.
- `lib/db`: Drizzle ORM schema and database connection.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** `express-session`, `bcryptjs`
- **Validation:** Zod
- **API Client Generation:** Orval (from OpenAPI spec)