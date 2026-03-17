# Testing Patterns

**Analysis Date:** 2026-03-17

## Test Framework

**Runner:**

- Vitest 4.0.18
- Playwright 1.58.2 (for E2E)
- Config: `vitest.config.ts` and `playwright.config.ts` in project root.

**Assertion Library:**

- Vitest built-in `expect`.
- Matchers: standard Jest-compatible matchers (`toBe`, `toEqual`, `toThrow`).

**Run Commands:**

```bash
pnpm test                              # Run all tests in watch mode
pnpm run test:all                      # Run all tests once
npx playwright test                    # Run E2E tests
```

## Test File Organization

**Location:**

- Unit/Integration tests: Collocated with source files (e.g., `src/features/tickets/hooks/useTickets.test.ts`).
- E2E tests: Located in `tests/e2e/`.

**Naming:**

- `*.test.ts` for unit/integration tests.
- `*.spec.ts` for Playwright E2E tests.

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("FeatureName", () => {
  it("should perform expected behavior", () => {
    // arrange
    // act
    // assert
  });
});
```

**Patterns:**

- Use `vi.mock` for mocking external dependencies (e.g., Supabase client).
- Use `beforeEach` to reset mocks or setup state.

## Mocking

**Framework:**

- Vitest built-in `vi` utility.

**What to Mock:**

- Supabase client and auth calls.
- External API integrations (e.g., Resend).
- Navigation and Next.js internal hooks.

## Test Types

**Unit Tests:**

- Focus on individual hooks and logic-heavy services.
- Located within feature folders.

**E2E Tests:**

- Focus on critical user flows (login, ticket creation, dashboard navigation).
- Uses Playwright to interact with a running instance of the app.
- Located in `tests/e2e/`.

---

_Testing analysis: 2026-03-17_
_Update when test patterns change_
