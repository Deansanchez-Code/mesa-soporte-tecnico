# Patrones de Pruebas

**Fecha de Análisis:** 2026-03-17

## Framework de Pruebas

**Ejecutor (Runner):**

- Vitest 4.0.18
- Playwright 1.58.2 (para E2E)
- Configuración: `vitest.config.ts` y `playwright.config.ts` en la raíz del proyecto.

## Librería de Aserciones

- `expect` integrado de Vitest.
- Emparejadores (Matchers): emparejadores estándar compatibles con Jest (`toBe`, `toEqual`, `toThrow`).

**Comandos de Ejecución:**

```bash
pnpm test                              # Ejecutar todas las pruebas en modo watch
pnpm run test:all                      # Ejecutar todas las pruebas una vez
npx playwright test                    # Ejecutar pruebas E2E
```

## Organización de Archivos de Prueba

**Ubicación:**

- Pruebas unitarias/de integración: Ubicadas junto a los archivos fuente (ej., `src/features/tickets/hooks/useTickets.test.ts`).
- Pruebas E2E: Ubicadas en `tests/e2e/`.

**Nombres:**

- `*.test.ts` para pruebas unitarias/de integración.
- `*.spec.ts` para pruebas E2E de Playwright.

## Estructura de las Pruebas

**Organización de la Suite:**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("NombreDeLaCaracteristica", () => {
  it("debe realizar el comportamiento esperado", () => {
    // organizar (arrange)
    // actuar (act)
    // afirmar (assert)
  });
});
```

**Patrones:**

- Usar `vi.mock` para simular dependencias externas (ej., cliente de Supabase).
- Usar `beforeEach` para reiniciar simulacros o configurar el estado.

## Simulacros (Mocking)

**Framework:**

- Utilidad `vi` integrada de Vitest.

**Qué simular:**

- Llamadas al cliente de Supabase y de autenticación.
- Integraciones de APIs externas (ej., Resend).
- Navegación y hooks internos de Next.js.

## Tipos de Pruebas

**Pruebas Unitarias:**

- Se centran en hooks individuales y servicios con mucha lógica.
- Ubicadas dentro de las carpetas de características (features).

**Pruebas E2E:**

- Se centran en flujos críticos de usuario (inicio de sesión, creación de tickets, navegación por el dashboard).
- Utiliza Playwright para interactuar con una instancia en ejecución de la aplicación.
- Ubicadas en `tests/e2e/`.

---

_Análisis de pruebas: 2026-03-17_
_Actualizar cuando cambien los patrones de prueba_
