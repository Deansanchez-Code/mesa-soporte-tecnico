# Codebase Structure

**Analysis Date:** 2026-03-17

## Directory Layout

```
mesa-soporte-tecnico/
├── .agent/             # GSD System resources and skills
├── .planning/          # Project planning and codebase mapping
├── public/             # Static assets (images, manifest, icons)
├── src/                # Source code root
│   ├── app/           # Next.js App Router (pages and layouts)
│   ├── components/    # Shared/Generic UI components
│   ├── context/       # Global React Contexts
│   ├── features/      # Modular business features
│   ├── hooks/         # Shared React hooks
│   ├── lib/           # Shared utilities and configurations
│   └── tests/         # Global test suite
├── supabase/           # Supabase config and migrations
└── package.json        # Manifest and dependencies
```

## Directory Purposes

**src/app/:**

- Purpose: Defines the routes and layouts of the application.
- Contains: `page.tsx`, `layout.tsx`, and route directories.

**src/features/:**

- Purpose: Core logic organized by business domain.
- Contains: Subdirectories for each feature (e.g., `tickets`, `assets`).
- Internal Structure:
  - `actions/`: Server logic for mutations.
  - `components/`: Feature-specific React components.
  - `hooks/`: Domain-specific hooks (mostly React Query).
  - `services/`: Low-level data access logic.
  - `types.ts`: TypeScript definitions for the feature.

**src/lib/:**

- Purpose: Shared utilities, third-party initializers, and core config.
- Key files: `logger.ts`, `env.ts`, `supabase/`.

**src/components/:**

- Purpose: General-purpose UI components (Buttons, Inputs, Modals).
- Contains: Highly reusable, non-business specific components.

## Key File Locations

**Entry Points:**

- `src/app/page.tsx`: Main dashboard/landing entry.
- `src/middleware.ts`: Global request interceptor.

**Configuration:**

- `next.config.ts`: Next.js settings and PWA config.
- `src/env.ts`: Environment variable validation (Zod).
- `package.json`: Dependency manifest.

## Naming Conventions

**Files:**

- `PascalCase.tsx`: React components.
- `camelCase.ts`: Utilities, hooks, and services.
- `kebab-case.ts`: For scripts or specific config files if needed.
- `*.test.ts`: Test files.

**Directories:**

- `kebab-case`: Standard for all directories.

## Where to Add New Code

**New Feature (e.g., "Inventario"):**

- Create `src/features/inventario/`.
- Add subdirectories for components, hooks, actions.

**New Shared Component:**

- Implementation: `src/components/ui/[Name].tsx`.

**New Shared Utility:**

- Implementation: `src/lib/[name].ts`.

---

_Structure analysis: 2026-03-17_
_Update when directory structure changes_
