# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**Email/SMS:**

- SMTP / Resend - Transactional emails (ticket notifications, etc.)
  - SDK/Client: `nodemailer`, `@react-email/components`
  - Auth: `SMTP_USER`, `SMTP_PASS`, `RESEND_API_KEY` (validated in `src/env.ts`)
  - Implementation: Used with React Email for templating.

## Data Storage

**Databases:**

- PostgreSQL on Supabase - Primary data store.
  - Connection: via `NEXT_PUBLIC_SUPABASE_URL` and keys.
  - Client: `@supabase/supabase-js` and `@supabase/ssr`.
  - Migrations: Managed in `supabase/migrations/`.

**File Storage:**

- Supabase Storage - Asset and ticket attachments.
  - SDK/Client: `@supabase/supabase-js`.
  - Buckets: Identifiable via Supabase dashboard.

## Authentication & Identity

**Auth Provider:**

- Supabase Auth - Email/password based authentication.
  - Implementation: `@supabase/ssr` for server-side session management in Next.js.
  - Token storage: Cookies handled by Supabase SSR.
  - Session management: Managed through Next.js middleware and Supabase hooks.

## CI/CD & Deployment

**Hosting:**

- Vercel - Primary hosting platform for the Next.js application.
  - Deployment: Automatic on git push to main.

**Monitoring:**

- Custom logging system in `src/lib/logger.ts`.

## Environment Configuration

**Development:**

- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Secrets location: `.env.local` (gitignored).

**Production:**

- Secrets management: Cloud-stored environment variables (Vercel).

---

_Integration audit: 2026-03-17_
_Update when adding/removing external services_
