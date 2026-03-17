# Codebase Concerns

**Analysis Date:** 2026-03-17

## Tech Debt

**Optional SMTP Configuration:**

- Issue: `SMTP_USER` and `SMTP_PASS` are marked as optional in `src/env.ts`.
- Why: To allow the app to build/run without local email setup.
- Impact: Silent failures in email notifications if env vars are missing in production.
- Fix approach: Make them required for production builds in `src/env.ts`.

**SLA Calculation Logic:**

- Issue: Manual calculation of SLA due dates and hours.
- Why: Custom business requirements for VIP users and specific categories.
- Impact: High complexity and potential for bugs in `src/lib/domain/sla-calculator.ts`.
- Fix approach: Add extensive unit tests for all edge cases (holidays, weekends, etc.).

## Security Considerations

**Content Security Policy (CSP):**

- Risk: Usage of `'unsafe-inline'` and `'unsafe-eval'` in `src/middleware.ts`.
- Current mitigation: Allowed for Next.js hydration and compatibility.
- Recommendations: Implement nonces for scripts and styles to remove 'unsafe-inline'.

**Exposed Supabase URL:**

- Risk: Potential exposure of internal Supabase project structure via public client.
- Current mitigation: RLS policies in the database.
- Recommendations: Audit all RLS policies to ensure no unauthorized data leaks.

## Fragile Areas

**Middleware Order:**

- Why fragile: The CSP and session update logic in `src/middleware.ts` is sensitive to ordering.
- Common failures: Changes in routing or asset matching can accidentally bypass security headers.
- Safe modification: Carefully test asset matching regex when adding new public routes.

## Test Coverage Gaps

**Feature-specific E2E:**

- What's not tested: Complex multi-step workflows like VIP ticket escalation.
- Risk: Integration issues between Supabase Realtime and UI might go unnoticed.
- Priority: Medium.

---

_Concerns audit: 2026-03-17_
_Update as issues are fixed or new ones discovered_
