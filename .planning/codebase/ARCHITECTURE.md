# Architecture

**Analysis Date:** 2026-03-17

## Pattern Overview

**Overall:** Full-stack Next.js Application with Feature-Based Modularity.

**Key Characteristics:**

- **App Router:** Hybrid rendering (Server/Client components).
- **Feature-Based:** Logic is encapsulated within `src/features/[feature-name]`.
- **Server Actions:** Primary method for mutations and data submission.
- **Supabase-Centric:** Heavy reliance on Supabase for Auth, DB, and Realtime.

## Layers

**UI Layer (React Components):**

- Purpose: Render interfaces and handle user interaction.
- Contains: Server Components (`src/app`), Client Components (`src/features/*/components`).
- Depends on: Hooks for state/logic, Actions for mutations.
- Used by: End users.

**Logic Layer (Custom Hooks):**

- Purpose: Manage client-side state and data fetching orchestration.
- Contains: React Query hooks.
- Location: `src/features/*/hooks`.
- Depends on: Services or Direct Supabase client.
- Used by: UI Components.

**Server Layer (Actions & Services):**

- Purpose: Execute business logic and database mutations on the server.
- Contains: Server Actions (`src/features/*/actions`), Business Services (`src/features/*/services`).
- Depends on: Supabase Client, Lib utilities.
- Used by: Form submissions, Click handlers (via Hooks).

**Data Layer (Supabase/PostgreSQL):**

- Purpose: Persistent storage and authentication.
- Contains: Tables, Views, RLS Policies.
- Managed via: `supabase/migrations`.

## Data Flow

**Typical Mutation Flow (e.g., Creating a Ticket):**

1. **Entry:** User submits a form in a Ticket component.
2. **Hook:** `useCreateTicket` hook calls the server action.
3. **Action:** `createTicketAction` (`src/features/tickets/actions/`) validates input with Zod.
4. **Service:** The action calls `TicketService` (`src/features/tickets/services/`) to interact with Supabase.
5. **DB:** Supabase executes the insert and checks RLS.
6. **Result:** Success/Error bubbles back to the UI to update state (e.g., via React Query invalidation).

**State Management:**

- **Server State:** Handled by TanStack Query.
- **Client State:** React `useState`/`useContext` where necessary.
- **Auth State:** Managed by Supabase SSR middleware and context providers.

## Key Abstractions

**Feature Module:**

- Purpose: Encapsulate everything related to a domain entity.
- Examples: `src/features/assets`, `src/features/tickets`.
- Pattern: Modular structure containing own components, hooks, and actions.

**Supabase Client:**

- Purpose: Unified interface for DB, Auth, and Storage.
- Pattern: Initialized via `@supabase/ssr` for server/client contexts.

## Entry Points

**Web Entry:**

- Location: `src/app/layout.tsx` and `src/app/page.tsx`.
- Responsibilities: Initialize providers (QueryClient, Auth), render root layout.

**Middleware:**

- Location: `src/middleware.ts`.
- Responsibilities: Session update, Security headers (CSP), Protected route redirection.

## Error Handling

**Strategy:** Zod validation at the boundary, try/catch in actions, Sonner toasts for UI feedback.

---

_Architecture analysis: 2026-03-17_
_Update when major patterns change_
