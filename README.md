# Mesa de Soporte Técnico

Plataforma integral para la gestión de tickets de soporte, asignación de ambientes y reservas de auditorio.

## Arquitectura del Proyecto

El proyecto sigue una estructura modular basada en características (Features) dentro de `src/features` y una capa de aplicación centrada en Next.js App Router en `src/app`.

### Tecnologías Principales

- **Framework**: Next.js 15+ (App Router)
- **Lenguaje**: TypeScript
- **Base de Datos & Auth**: Supabase
- **Estilos**: Tailwind CSS & Lucide Icons
- **Notificaciones**: Sonner
- **Testing**: Vitest (Unit/Integration) & Playwright (E2E)
- **Documentación**: TypeDoc

### Estructura de Directorios

- `src/app`: Rutas del servidor, APIs y Layouts.
- `src/features`: Lógica de negocio organizada por dominios (tickets, assignments, reservations).
- `src/lib`: Utilidades globales, configuración de clientes (Supabase) y middlewares.
- `src/components`: Componentes UI genéricos y elementos de diseño compartidos.

## Guía de Desarrollo

### Requisitos Previos

- Node.js 20+
- pnpm 9+

### Instalación

```bash
pnpm install
```

### Ejecución en Desarrollo

```bash
pnpm dev
```

### Calidad y Mantenimiento

- **Linting**: `pnpm lint`
- **Chequeo de Tipos**: `npx tsc --noEmit`
- **Tests Unitarios**: `pnpm test:all`
- **Tests E2E**: `npx playwright test`
- **Generar Documentación**: `pnpm docs:generate` (Salida en `docs/api`)

## CI/CD

El proyecto cuenta con un flujo de Integración Contínua en GitHub Actions que ejecuta automáticamente el linting, chequeo de tipos y los tests en cada push a las ramas `main` y `developer`.
