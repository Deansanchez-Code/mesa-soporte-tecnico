# Integraciones Externas

**Fecha de Análisis:** 2026-03-17

## APIs y Servicios Externos

**Correo Electrónico/SMS:**

- SMTP / Resend - Correos transaccionales (notificaciones de tickets, etc.)
  - SDK/Cliente: `nodemailer`, `@react-email/components`
  - Autenticación: `SMTP_USER`, `SMTP_PASS`, `RESEND_API_KEY` (validado en `src/env.ts`)
  - Implementación: Utilizado con React Email para plantillas.

## Almacenamiento de Datos

**Bases de Datos:**

- PostgreSQL en Supabase - Almacén de datos principal.
  - Conexión: vía `NEXT_PUBLIC_SUPABASE_URL` y llaves.
  - Cliente: `@supabase/supabase-js` and `@supabase/ssr`.
  - Migraciones: Gestionadas en `supabase/migrations/`.

**Almacenamiento de Archivos:**

- Supabase Storage - Archivos adjuntos de activos y tickets.
  - SDK/Cliente: `@supabase/supabase-js`.
  - Buckets: Identificables vía el panel de control de Supabase.

## Autenticación e Identidad

**Proveedor de Autenticación:**

- Supabase Auth - Autenticación basada en correo/contraseña.
  - Implementación: `@supabase/ssr` para la gestión de sesiones en el servidor en Next.js.
  - Almacenamiento de tokens: Cookies gestionadas por Supabase SSR.
  - Gestión de sesiones: Gestionada a través del middleware de Next.js y los hooks de Supabase.

## CI/CD y Despliegue

**Alojamiento (Hosting):**

- Vercel - Plataforma de alojamiento principal para la aplicación Next.js.
  - Despliegue: Automático al hacer push a la rama main.

**Monitoreo:**

- Sistema de logs personalizado en `src/lib/logger.ts`.

## Configuración del Entorno

**Desarrollo:**

- Variables de entorno requeridas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Ubicación de secretos: `.env.local` (ignorado por git).

**Producción:**

- Gestión de secretos: Variables de entorno almacenadas en la nube (Vercel).

---

_Auditoría de integración: 2026-03-17_
_Actualizar al añadir/eliminar servicios externos_
