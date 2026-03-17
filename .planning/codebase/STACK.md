# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**

- TypeScript 5.9.3 - All application code and type safety.

**Secondary:**

- JavaScript - Configuration files (`eslint.config.mjs`, `postcss.config.mjs`).

## Runtime

**Environment:**

- Node.js (Version managed via pnpm)
- Browser-based PWA (Progressive Web App)

**Package Manager:**

- pnpm - Used for dependency management and scripts.
- Lockfile: `pnpm-lock.yaml` present.

## Frameworks

**Core:**

- Next.js 16.1.1 - Application framework and routing (App Router).
- React 19.2.0 - UI library.

**Testing:**

- Vitest 4.0.18 - Unit and integration testing.
- Playwright 1.58.2 - E2E testing.

**Build/Dev:**

- Tailwind CSS 4.2.1 - Styling framework.
- TypeScript 5.9.3 - Transpilation and type checking.
- PostCSS 8.x - CSS processing.

## Key Dependencies

**Critical:**

- @supabase/supabase-js 2.99.0 - Database and authentication client.
- @supabase/ssr 0.8.0 - Supabase integration for Next.js SSR.
- @tanstack/react-query 5.90.21 - Data fetching and state management.
- Zod 4.3.6 - Schema validation.
- lucide-react 0.563.0 - Icon set.

**Infrastructure:**

- next-pwa 5.6.0 - PWA support.
- nodemailer 8.0.2 - Email sending (used with React Email).
- class-variance-authority 0.7.1 - CSS-in-TS utility.

## Configuration

**Environment:**

- Configured via `.env` files (loaded by `src/env.ts` with validation).
- Key configs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Build:**

- `next.config.ts`, `tsconfig.json`, `tailwind.config.ts` (or equivalent).

## Platform Requirements

**Development:**

- Windows/macOS/Linux with Node.js and pnpm.
- Supabase project for backend services.

**Production:**

- Deployment target: Vercel (Next.js optimized).
- Database/Auth: Supabase.

---

_Stack analysis: 2026-03-17_
_Update after major dependency changes_
