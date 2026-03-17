# Convenciones de Codificación

**Fecha de Análisis:** 2026-03-17

## Patrones de Nombres

**Archivos:**

- `PascalCase.tsx` para componentes de React.
- `camelCase.ts` para hooks, acciones, servicios y utilidades.
- `*.test.ts` para pruebas de Vitest.
- `*.spec.ts` para pruebas de Playwright.

**Funciones:**

- `camelCase` para todas las funciones.
- `use[Nombre]` para hooks personalizados de React.
- `[nombre]Action` para Server Actions (exportadas desde `actions/`).
- `handle[Evento]` para controladores de eventos internos.

**Variables:**

- `camelCase` para variables y parámetros.
- `UPPER_SNAKE_CASE` para constantes y llaves de variables de entorno.

**Tipos:**

- `PascalCase` para Interfaces y Tipos.
- Sin prefijo `I` para interfaces.

## Estilo de Código

**Formateo:**

- Prettier gestionado vía `.prettierrc` (inferido de la configuración de `package.json`).
- ESLint para análisis estático (`eslint.config.mjs`).

**Organización de Importaciones:**

- Orden: React/Next core -> Librerías de terceros -> Alias de ruta (`@/*`) -> Importaciones relativas.
- Alias de ruta: `@/` apunta a `src/`.

## Manejo de Errores

**Patrones:**

- **Server Actions:** Usar bloques `try/catch`.
- **Validación:** Usar esquemas de Zod (`safeParse`) al inicio de acciones y servicios.
- **Utilidades:** `handleActionError` y `createActionResponse` de `@/lib/server-action-utils` para estandarizar las respuestas.

**Registro de Logs (Logging):**

- Usar la clase personalizada `Logger` de `@/lib/logger.ts`.
- Evitar `console.log` directos en el código de producción.

## Diseño de Módulos

- **Encapsulación de Características (Features):** Toda la lógica de un dominio debe permanecer dentro de su carpeta de característica en `src/features/`.
- **API Pública:** Los componentes y hooks deben ser la superficie principal exportada de las características.
- **Solo Servidor:** Usar la directiva `"use server"` al inicio de los archivos de acciones.

---

_Análisis de convenciones: 2026-03-17_
_Actualizar cuando cambien los patrones_
