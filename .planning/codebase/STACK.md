# Stack Tecnológico

**Fecha de Análisis:** 2026-03-17

## Lenguajes

**Principal:**

- TypeScript 5.9.3 - Todo el código de la aplicación y seguridad de tipos.

**Secundario:**

- JavaScript - Archivos de configuración (`eslint.config.mjs`, `postcss.config.mjs`).

## Entorno de Ejecución (Runtime)

**Ambiente:**

- Node.js (Versión gestionada vía pnpm)
- PWA basada en navegador (Progressive Web App)

**Gestor de Paquetes:**

- pnpm - Utilizado para la gestión de dependencias y scripts.
- Archivo de bloqueo: `pnpm-lock.yaml` presente.

## Frameworks

**Core:**

- Next.js 16.1.1 - Framework de aplicación y enrutamiento (App Router).
- React 19.2.0 - Librería de UI.

**Pruebas (Testing):**

- Vitest 4.0.18 - Pruebas unitarias y de integración.
- Playwright 1.58.2 - Pruebas E2E.

**Construcción/Desarrollo:**

- Tailwind CSS 4.2.1 - Framework de estilos.
- TypeScript 5.9.3 - Transpilación y comprobación de tipos.
- PostCSS 8.x - Procesamiento de CSS.

## Dependencias Clave

**Críticas:**

- @supabase/supabase-js 2.99.0 - Cliente de base de datos y autenticación.
- @supabase/ssr 0.8.0 - Integración de Supabase para SSR de Next.js.
- @tanstack/react-query 5.90.21 - Obtención de datos y gestión de estado.
- Zod 4.3.6 - Validación de esquemas.
- lucide-react 0.563.0 - Conjunto de iconos.

**Infraestructura:**

- next-pwa 5.6.0 - Soporte de PWA.
- nodemailer 8.0.2 - Envío de correos electrónicos (utilizado con React Email).
- class-variance-authority 0.7.1 - Utilidad CSS-in-TS.

## Configuración

**Entorno:**

- Configurado vía archivos `.env` (cargados por `src/env.ts` con validación).
- Configuraciones clave: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Construcción:**

- `next.config.ts`, `tsconfig.json`, `tailwind.config.ts` (o equivalente).

## Requisitos de la Plataforma

**Desarrollo:**

- Windows/macOS/Linux con Node.js y pnpm.
- Proyecto de Supabase para servicios de backend.

**Producción:**

- Objetivo de despliegue: Vercel (optimizado para Next.js).
- Base de datos/Autenticación: Supabase.

---

_Análisis de stack: 2026-03-17_
_Actualizar tras cambios importantes en dependencias_
