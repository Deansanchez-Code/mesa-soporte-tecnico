# Registro de Trabajo (Work Log)

## Sesión: 2026-04-27

**Rama:** `feat/mejora-gradual-seguridad-calidad`
**Modo:** Diagnóstico y Ejecución Gradual (Fases 1-3)

### Qué se desarrolló

1. **Fase 1 (Calidad):** Implementación de pruebas extendidas para el calculador de SLA (`sla-extended.test.ts`). Se validaron casos de borde de cambio de año, Semana Santa y límites de jornada laboral.
2. **Fase 2 (Seguridad):** Auditoría completa de políticas RLS. Se implementó la migración `20260427_secure_assets_and_users.sql` para corregir la visibilidad excesiva en `assets`, `asset_events` y `users` (ADR-005).
3. **Fase 3 (UX):** Refactorización del sistema de notificaciones. Se corrigieron errores de tipos (`null` vs `boolean`) y advertencias de linter en `NotificationManager.tsx`.
4. **Mantenimiento:** Limpieza de advertencias de Markdown en logs y documentación. Se añadió aviso informativo en `AuditoriumReservationForm.tsx` sobre el uso del cable HDMI óptico. Se implementó la eliminación automática de tickets al cancelar reservas (usuarios y VIP).

### Cómo se desarrolló

- **Tests de SLA:** Se diseñaron escenarios con `date-fns` simulando fechas críticas (31 Dic -> 2 Ene) y se confirmó el salto correcto de festivos colombianos.
- **Auditoría RLS:** Se analizaron los scripts de migración y el `full_reset_db.sql`, detectando el uso recurrente de `USING (true)` para el rol `authenticated` en tablas de inventario.
- **Notificaciones:** Se implementó una lógica de "vencimiento inminente" que alerta 15 minutos antes de que un ticket expire, mejorando la proactividad de los agentes.

### Errores detectados y Lecciones aprendidas (2026-04-27)

- **Lección:** Las políticas RLS que usan `USING (true)` para usuarios autenticados son un antipatrón de seguridad si la tabla contiene datos que no pertenecen a todos los usuarios (ej. activos asignados).
- **Lección:** El uso de un servicio centralizado para notificaciones del navegador facilita la gestión de permisos y evita la duplicidad de lógica en componentes React.

### Pendientes (2026-04-27)

- Aplicar las correcciones de RLS propuestas en el ADR-005.
- Evaluar la refactorización de UI (Fase 4: shadcn/ui).

---

## Sesión: 2026-04-25

**Rama:** `fix/estabilizacion-seguridad-entorno`
**Modo:** Diagnóstico y Fase 1 (Estabilización)

### Qué se desarrolló (2026-04-25 - Estabilización)

1. Se generó un diagnóstico inicial de la base de código (`DIAGNOSTICO.md`).
2. Se implementó la Fase 1 del plan de mejora, centrada en seguridad y variables de entorno.
3. Se realizó una limpieza profunda del repositorio, eliminando archivos obsoletos y temporales.
4. Se implementó la Fase 2: Robustez Lógica (Festivos Colombia y Pruebas).
5. Se implementó la Fase 3: Optimización y UX (Tabla Admin y Filtros).

### Cómo se desarrolló (2026-04-25 - Estabilización)

- **Ajuste de Entorno (SMTP):** Se modificó la validación de Zod en `src/env.ts` para omitirla durante el `npm_lifecycle_event === 'build'` o si `SKIP_ENV_VALIDATION` está activo.
- **Ajuste de Middleware (CSP):** Se refactorizó `src/middleware.ts` y `src/lib/supabase/middleware.ts` para generar un _nonce_ criptográfico único por cada petición.
- **Limpieza del Proyecto:** Se escanearon y eliminaron 18 archivos identificados como basura.
- **Lógica de Festivos Colombia:** Se integró la utilidad `isColombianHoliday` en `sla-calculator.ts` para que el cálculo de SLA respecte automáticamente los festivos de Colombia.
- **Expansión de Pruebas:** Se añadieron tests unitarios para casos de borde en el SLA y pruebas E2E en Playwright.
- **Mejoras de Tabla Admin:** Se implementó _Sticky Header_ en la tabla de tickets para mejorar la navegación en listas largas.
- **Filtros Avanzados:** Se añadió un botón de filtro rápido para tickets **VIP** (Críticos), actualizando el hook de consulta y los tipos de datos.
- **Alertas de Urgencia:** Se implementó un resaltado visual (ámbar con pulso) para tickets que están a menos de 1 hora de vencer, facilitando la priorización visual.

### Errores detectados y Lecciones aprendidas (2026-04-25)

- **Error Histórico:** Validar variables de entorno críticas (como SMTP) usando solo `NODE_ENV === 'production'` causa fallos durante el build en Vercel, ya que el paso de compilación no suele contar con estas variables.
- **Solución/Lección:** Siempre saltar la validación de entorno en tiempo de construcción si las variables solo son necesarias en tiempo de ejecución.
- **Error Histórico:** Dificultad para pasar encabezados modificados (`x-nonce`) a través de funciones como `updateSession` en Supabase.
- **Solución/Lección:** Para propagar encabezados en middlewares de Next.js de manera concurrente con la actualización de sesión, la función envolvente (`updateSession`) debe aceptar las cabeceras modificadas (`requestHeaders`) y pasarlas explícitamente a `NextResponse.next({ request: { headers: requestHeaders } })`.

### Pendientes (2026-04-25)

- Continuar con la Fase 2 del Diagnóstico: Pruebas unitarias para el calculador de SLA y E2E para flujos críticos.
