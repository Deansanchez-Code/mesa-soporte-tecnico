---
name: playwright-e2e-testing
description: Guía de pruebas de extremo a extremo (E2E) con Playwright para Next.js 16 y Supabase. Cubre ejecución de suites, aislamiento de sesiones de autenticación, verificación de flujos críticos (login, tickets, reservas y roles VIP) y depuración visual con trace viewer.
---

# Playwright E2E Testing Guide

Guía y estándares de pruebas End-to-End para aplicaciones Next.js y Supabase en `mesa-soporte-tecnico`.

## 1. Estructura y Filosofía de Pruebas

- **Ubicación:** `tests/e2e/*.spec.ts`
- **Enfoque de Caja Negra:** Probar el comportamiento desde la perspectiva del usuario final (formularios, navegación, permisos y mensajes de error o éxito).
- **Aislamiento:** Cada prueba o grupo de pruebas (`test.describe`) debe ser independiente y no depender del estado mutado por tests anteriores.

---

## 2. Comandos Clave de Ejecución

```bash
# Ejecutar todas las pruebas E2E en modo headless
pnpm exec playwright test

# Ejecutar un archivo de prueba específico
pnpm exec playwright test tests/e2e/login.spec.ts

# Ejecutar con interfaz interactiva (UI Mode)
pnpm exec playwright test --ui

# Ejecutar con navegador visible (Headed)
pnpm exec playwright test --headed

# Inspeccionar reporte HTML tras la ejecución
pnpm exec playwright show-report
```

---

## 3. Patrones de Código Recomendados

### A. Autenticación y Manejo de Sesiones

Al probar flujos protegidos por Supabase SSR, esperar elementos visibles en lugar de usar `page.waitForTimeout()`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Flujo de Autenticación y Dashboard", () => {
  test("debe permitir inicio de sesión y redirigir correctamente", async ({
    page,
  }) => {
    await page.goto("/login");

    // Rellenar credenciales con selectores accesibles
    await page.getByLabel(/correo electrónico/i).fill("test@empresa.com");
    await page.getByLabel(/contraseña/i).fill("Password123!");

    // Disparar envío
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    // Validar redirección y estado autenticado
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(
      page.getByRole("heading", { name: /bienvenido|panel/i }),
    ).toBeVisible();
  });
});
```

### B. Pruebas de Conflicto en Formularios (Reservas / Tickets)

```typescript
test("debe mostrar mensaje de conflicto ante solapamiento de horario", async ({
  page,
}) => {
  await page.goto("/reservas/nueva");

  await page.getByLabel(/espacio/i).selectOption("Auditorio Principal");
  await page.getByLabel(/fecha y hora de inicio/i).fill("2026-11-01T10:00");
  await page.getByLabel(/fecha y hora de fin/i).fill("2026-11-01T12:00");

  await page.getByRole("button", { name: /confirmar reserva/i }).click();

  // Aserción del toast o mensaje de error de conflicto
  await expect(
    page.getByText(/horario no disponible|conflicto detectado/i),
  ).toBeVisible();
});
```

---

## 4. Buenas Prácticas y Reglas Anti-Fragilidad

1. **Priorizar Localizadores Semánticos:**
   - Usar `page.getByRole()`, `page.getByLabel()`, `page.getByText()` sobre selectores CSS rígidos (`div > span.btn-primary`).
2. **Prohibido Esperas Fijas (`waitForTimeout`):**
   - Usar aserciones web-first con reintentos automáticos como `expect(locator).toBeVisible()`.
3. **Manejo de Traces y Capturas:**
   - En caso de fallo, Playwright guarda el trace en `test-results/`. Analizarlo con:
     ```bash
     pnpm exec playwright show-trace test-results/<resultado>/trace.zip
     ```
