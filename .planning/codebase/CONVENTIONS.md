# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**

- `PascalCase.tsx` for React components.
- `camelCase.ts` for hooks, actions, services, and utilities.
- `*.test.ts` for Vitest tests.
- `*.spec.ts` for Playwright tests.

**Functions:**

- `camelCase` for all functions.
- `use[Name]` for custom React hooks.
- `[name]Action` for Server Actions (exported from `actions/`).
- `handle[Event]` for internal event handlers.

**Variables:**

- `camelCase` for variables and parameters.
- `UPPER_SNAKE_CASE` for constants and environment variable keys.

**Types:**

- `PascalCase` for Interfaces and Types.
- No `I` prefix for interfaces.

## Code Style

**Formatting:**

- Prettier managed via `.prettierrc` (inferred from `package.json` setup).
- ESLint for static analysis (`eslint.config.mjs`).

**Import Organization:**

- Order: React/Next core -> Third-party libraries -> Path aliases (`@/*`) -> Relative imports.
- Path aliases: `@/` points to `src/`.

## Error Handling

**Patterns:**

- **Server Actions:** Use `try/catch` blocks.
- **Validation:** Use Zod schemas (`safeParse`) at the beginning of actions and services.
- **Utilities:** `handleActionError` and `createActionResponse` from `@/lib/server-action-utils` to standardize responses.

**Logging:**

- Use the custom `Logger` class from `@/lib/logger.ts`.
- Avoid direct `console.log` in production code.

## Module Design

- **Feature Encapsulation:** All logic for a domain must stay within its feature folder in `src/features/`.
- **Public API:** Components and hooks should be the primary exported surface for features.
- **Server-Only:** Use `"use server"` directive at the top of action files.

---

_Convention analysis: 2026-03-17_
_Update when patterns change_
