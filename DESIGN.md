# DESIGN.md — Sistema de Diseño Semántico SENA TIC (Swiss GovTech & Bento Modular Nativo)

> Contrato de diseño vivo alineado con `stitch-design-taste`, `design-system`, `modern-web-guidance`, `ui-ux-pro-max` y `ui-finish-gate`.

---

## 1. Calibración de Ejes (`stitch-design-taste`)

- **`DESIGN_VARIANCE`: `7 / 10`** — Retícula Bento asimétrica con bordes técnicos de `1px solid` (`#E2E8F0`), cabeceras institucionales numeradas (`01 / ...`, `02 / ...`) y contraste entre bloques de autoridad (`#043263`) y celdas operativas (`#FFFFFF` / `#F8FAFC`).
- **`MOTION_INTENSITY`: `6 / 10`** — Transiciones aceleradas por hardware (`transform`, `opacity`), micro-interacción táctil `active:translate-y-[1px]`, animaciones nativas `<dialog>` con `@starting-style` y respeto estricto a `@media (prefers-reduced-motion: reduce)`.
- **`VISUAL_DENSITY`: `6 / 10`** — Densidad técnica equilibrada: alta legibilidad táctil en Kiosko (`hit targets >= 44x44px`) y escaneo rápido con números tabulares (`tabular-nums`) en paneles de coordinación y administración.

---

## 2. Arquitectura de Tokens en 3 Capas (`design-system`)

Implementada en `src/app/globals.css`:

1. **Capa 1 — Tokens Primitivos (Identidad Institucional SENA + Escala Pizarra):**
   - `--sena-green-500: #39a900` (`--sena-green-600: #2d8500`, `--sena-green-50: #f0fdf4`)
   - `--sena-navy-900: #043263` (`--sena-navy-950: #032244`, `--sena-navy-800: #053b75`)
   - `--sena-orange-500: #fc7323` (`--sena-orange-50: #fff7ed`)
   - `--slate-50: #f8fafc`, `--slate-100: #f1f5f9`, `--slate-200: #e2e8f0`, `--slate-600: #475569`, `--slate-900: #0f172a`
2. **Capa 2 — Tokens Semánticos:**
   - Superficies: `--surface-canvas` (`#f8fafc`), `--surface-card` (`#ffffff`), `--surface-subtle` (`#f1f5f9`)
   - Texto: `--text-primary` (`#0f172a`), `--text-secondary` (`#475569`), `--text-muted` (`#64748b`)
   - Bordes: `--border-hairline` (`#e2e8f0`), `--border-strong` (`#cbd5e1`)
   - Estados: `--status-enabled` (`#39a900`), `--status-paused` (`#fc7323`), `--status-danger` (`#e11d48`)
3. **Capa 3 — Tokens de Componente & Primitivas Web:**
   - `.bento-grid-swiss`: Retícula técnica con líneas divisorias de `1px` (`background: var(--border-hairline); gap: 1px; padding: 1px;`).
   - `.tabular-mono`: Tipografía monospace con `font-variant-numeric: tabular-nums` para PINs, SLAs, fechas, horas y contadores.
   - `.skeleton-shimmer`: Esqueleto de carga estructural con gradiente animado.

---

## 3. Tipografía y Reglas Numéricas

- **Sans Principal (`--font-sans`):** `Plus Jakarta Sans` (con fallback geométrico limpio del sistema).
- **Monospace Técnica (`--font-mono`):** `JetBrains Mono` con `font-variant-numeric: tabular-nums` obligatorio en:
  - Cajas e ingreso de PIN VIP de 6 dígitos.
  - Reloj institucional (`America/Bogota` UTC-5) y rangos horarios de reservas.
  - Contadores de ambientes habilitados vs. en pausa y métricas SLA.

---

## 4. Primitivas Web Nativas (`modern-web-guidance`)

- **Modales `<dialog>` Nativos (`src/components/ui/NativeDialog.tsx`):** Uso de `.showModal()` y `.close()` con `::backdrop` difuminado, foco atrapado nativo y cierre automático con tecla `Escape`.
- **Container Queries (`@container`):** Aplicadas en contenedores de reservas y portal de solicitudes para adaptación fluida según el ancho real de la columna.
- **Viewport Dinámico (`min-h-dvh`):** Evita saltos de barra de navegación en tablets de coordinación y Kiosko táctil.

---

## 5. Contrato por Pantalla (`ui-finish-gate`)

### Kiosko & Portal de Solicitudes (`src/app/page.tsx`, `src/features/requests/components/UserRequestForm.tsx`)

- **Usuario + Tarea:** Instructores, funcionarios, contratistas y coordinadores VIP registrando tickets o reservando espacios en menos de 30 segundos.
- **Objeto de Primera Lectura:** Identificador institucional `GOV·SENA·2026`, buscador de documento/cédula o teclado PIN VIP de 6 dígitos (`>=48px` por tecla).
- **Restricción Innegociable:** La **Card 2 (`Reservas & Espacios`)** conserva su disposición vertical aprobada. Cero `alert()` nativos del navegador.

### Matriz de Ambientes & Reservas (`src/features/reservations/components/AuditoriumReservationForm.tsx`)

- **Objeto de Primera Lectura:** Matriz Bento `1px` de espacios especiales con contadores `Habilitados` vs `En Pausa` en `tabular-mono`.
- **Visibilidad de Estado:** Los ambientes en pausa o remodelación permanecen visibles con etiqueta `PAUSA` (`#FC7323`) para transparencia operativa.
