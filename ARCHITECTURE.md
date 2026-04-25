# Arquitectura del Proyecto

## Stack Tecnológico

- **Frontend:** Next.js 14+ (App Router).
- **Lenguaje:** TypeScript.
- **Estilos:** Tailwind CSS / Lucide React para iconografía.
- **Backend/Base de Datos:** Supabase (PostgreSQL, Auth, Storage, Realtime).
- **Estado Global/Queries:** TanStack Query (React Query).
- **Validación:** Zod.
- **Despliegue:** Vercel.

## Estructura de Directorios (Inferred)

- `src/app`: Rutas y páginas de la aplicación.
- `src/features`: Lógica de negocio organizada por dominios (tickets, users, assets, etc.).
- `src/lib`: Utilidades globales, configuraciones de Supabase y lógica de dominio compartida.
- `src/components`: Componentes de UI reutilizables y layout.
- `tests`: Suites de pruebas unitarias (Vitest) y E2E (Playwright).

## Patrones de Diseño

- **Feature-Based Architecture:** Organización de archivos por funcionalidad para mejorar la escalabilidad.
- **Domain Logic Separation:** Lógica crítica (como el cálculo de SLA) separada de los componentes de UI.
- **Middleware Security:** Uso de middlewares para gestión de sesiones y políticas de seguridad (CSP).
