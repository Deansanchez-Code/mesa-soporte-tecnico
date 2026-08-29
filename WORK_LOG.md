# Registro de Trabajo (Work Log)

## Sesión: 2026-08-29

**Rama:** `fix/weekly-reservations-validation`
**Modo:** Optimización de Reservas & Pausa por Remodelación

### Qué se desarrolló (2026-08-29)

1. **Corrección y Optimización de Reservas Semanales:**
   - Se ajustó el hook de reservas para abarcar el rango completo de semanas al solicitar repetición semanal (`effectiveFinalDate`).
   - Se corrigió la detección de conflictos en el formulario para comparar únicamente contra los días exactos programados (`targetDates`) evitando falsos positivos por días intermedios.
   - Se añadió un componente de etiquetas visuales para previsualizar cada una de las sesiones programadas (ej. `VIE 6/3/2026`).

2. **Carga Reactiva de Fecha por Doble Clic:**
   - Sincronización reactiva con `useEffect` en `AuditoriumReservationForm.tsx` al cambiar `initialDate` o `initialSpace`.
   - Inclusión de botón rápido "Reservar esta fecha" en el modal de detalle de día en `CalendarView.tsx`.

3. **Módulo de Pausa de Reservas por Remodelación (Auditorio):**
   - Configuración en tabla `system_settings` (`auditorium_maintenance`) y servicios de cliente/servidor.
   - Regla de negocio de vigencia 2026 en caso de no definir fecha fin, o indicación de fecha estimada de reapertura.
   - Componente `AuditoriumMaintenanceModal.tsx` con mensaje institucional, disculpas y redirección a Coordinación Académica/Formación.
   - Bloqueo en tres niveles: Tarjeta principal de selección, formulario de reservas y acciones de servidor (`reservationActions.ts`).
   - Módulo de administración en la pestaña de configuración de `/admin`.

4. **Barrido Automático de Reservas y Notificación Consolidada por Usuario:**
   - Al activar la suspensión desde el panel de administración, el servidor ejecuta un barrido automático de todas las reservas existentes en estado `APPROVED` o `PENDING` dentro del periodo de remodelación.
   - Pasa automáticamente las reservas al estado `CANCELLED`.
   - **Cancelación en Bandeja de Técnicos:** Se localizan y actualizan automáticamente al estado `CANCELADO` todos los tickets de soporte activos vinculados a dichas reservas en la mesa de ayuda (`tickets`), registrando la trazabilidad en `ticket_events` con el motivo de obras en auditorio.
   - Agrupa las reservas canceladas por cada funcionario afectado (`Map<userId, UserGroup>`).
   - Envía **un único correo electrónico consolidado por usuario** mediante la plantilla `MaintenanceCancellationNotification.tsx`, listando todas sus sesiones afectadas, las disculpas institucionales y los canales de contacto con la Coordinación Académica/Formación.
   - Registra notificaciones internas en la tabla `user_notifications` y retroalimenta al administrador en pantalla con el número exacto de reservas canceladas y usuarios notificados.

### Cómo se desarrolló (2026-08-29)

- **Backend:** Actualización de `createReservationAction` y `createReservationBatchAction` para validar rangos de remodelación y creación de `getAuditoriumMaintenanceAction` y `saveAuditoriumMaintenanceAction`.
- **Frontend / UI:** Integración de modales, sincronización de estados reactivos y renderizado condicional con feedback en tiempo real.

### Errores detectados y Lecciones aprendidas (2026-08-29)

- **Lección:** Cuando un formulario maneja repeticiones por saltos de días (cada 7 días), la validación de conflictos visual debe construirse por conjunto de fechas exactas (`Set<string>`) y no por comparación ciega de rangos horarios continuos.
- **Lección:** Las props de inicialización (`initialDate`) en modales reutilizables requieren sincronizadores con `useEffect` si el componente puede permanecer montado entre diferentes aperturas.

---

## Sesión: 2026-04-28

**Rama:** `fix/trazabilidad-cancelacion-tickets` (PR generado para merge a `main`)
**Modo:** Diagnóstico y Refactorización (GSD)

### Qué se desarrolló (2026-04-28)

1. **Refactorización de Cancelación de Reservas:** Se eliminó la lógica de "hard delete" en los tickets de soporte asociados a cancelaciones de auditorio (`reservationActions.ts`) y biblioteca (`libraryApprovalActions.ts`).
2. **Implementación de Soft Update:** Los tickets ahora se actualizan al estado `CANCELADO` en lugar de borrarse. Se añade una nota de auditoría automática en el campo `description` con fecha, hora y el actor que realizó la cancelación.
3. **Mejora de UX en Dashboard Admin:** Se añadió soporte visual para el estado `CANCELADO` (badge gris) y se excluyeron estos tickets del cálculo de alertas de vencimiento de SLA.
4. **Mejora de Trazabilidad en Kanban:** La columna de "Resueltos" ahora incluye tickets `CANCELADO` de las últimas 12 horas, con badges y textos descriptivos específicos ("Reserva cancelada").

### Cómo se desarrolló (2026-04-28)

- **Acciones de Servidor:** Se modificó `cancelReservationAction` y `cancelLibraryReservation` para realizar un `.update()` en la tabla `tickets`. Se integró un filtro `.not('status', 'in', '(...)')` para evitar procesar tickets ya cerrados.
- **UI/UX:** Se actualizaron los filtros en `src/app/admin/page.tsx` y `src/app/dashboard/page.tsx` para manejar el nuevo estado de manera consistente con el ciclo de vida de los tickets.

### Errores detectados y Lecciones aprendidas (2026-04-28)

- **Lección:** La eliminación física de registros vinculados a procesos de negocio (como reservas) destruye la trazabilidad histórica necesaria para métricas y auditorías. Siempre preferir "Soft Updates" o cambios de estado.
- **Lección:** Al automatizar cambios de estado, es vital verificar el estado actual del registro para evitar inconsistencias (ej. no cancelar un ticket que ya fue resuelto manualmente por un agente).

### Pendientes (2026-04-28)

- Monitorear el volumen de tickets en la columna de "Resueltos" para ajustar el tiempo de persistencia si es necesario.

---

## Sesión: 2026-04-27

**Rama:** `feat/mejora-gradual-seguridad-calidad`
**Modo:** Diagnóstico y Ejecución Gradual (Fases 1-3)

### Qué se desarrolló (2026-04-27)

1. **Fase 1 (Calidad):** Implementación de pruebas extendidas para el calculador de SLA (`sla-extended.test.ts`). Se validaron casos de borde de cambio de año, Semana Santa y límites de jornada laboral.
2. **Fase 2 (Seguridad):** Auditoría completa de políticas RLS. Se implementó la migración `20260427_secure_assets_and_users.sql` para corregir la visibilidad excesiva en `assets`, `asset_events` y `users` (ADR-005).
3. **Fase 3 (UX):** Refactorización del sistema de notificaciones. Se corrigieron errores de tipos (`null` vs `boolean`) y advertencias de linter en `NotificationManager.tsx`.
4. **Mantenimiento:** Limpieza de advertencias de Markdown en logs y documentación. Se añadió aviso informativo en `AuditoriumReservationForm.tsx` sobre el uso del cable HDMI óptico. Se implementó la eliminación automática de tickets al cancelar reservas (usuarios y VIP).

### Cómo se desarrolló (2026-04-27)

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

---

## Sesión: 2026-07-01

**Rama:** `visual-improvement-proposal`
**Modo:** Diagnóstico y Optimización de UX/UI

### Qué se desarrolló (2026-07-01)

1. **Eliminación y Reemplazo de Soporte Técnico:** Se removió la tarjeta obsoleta de reporte técnico en `UserRequestForm.tsx`. En su lugar, se implementó el widget dinámico "Eventos de Hoy", el cual consulta en tiempo real las reservas aprobadas del día en curso en formato de tarjetas compactas y visuales categorizadas por espacio.
2. **Optimización del Calendario Móvil:** Se rediseñó `CalendarView.tsx` para ocultar la lista densa de asignaciones en celulares, reduciendo el alto mínimo de las celdas a 50px y habilitando una sección inferior de visualización de eventos inline para el día seleccionado.
3. **Calibración de Husos Horarios (Timezone Fix):** Se forzó el huso horario de Colombia (`-05:00`) al instanciar objetos `Date` en `AuditoriumReservationForm.tsx`, eliminando desfases en el calendario y en el contenido de los correos automáticos enviados a los usuarios.
4. **Modal de Confirmación de Reserva con Autocierre:** Se implementó una ventana modal interactiva con una cuenta regresiva de 5 segundos tras registrar una reserva, brindando al usuario un resumen detallado y la posibilidad de cierre manual rápido.

### Cómo se desarrolló (2026-07-01)

- **UI/UX:** Se actualizaron `CalendarView.tsx` y `UserRequestForm.tsx` con clases responsivas de Tailwind y validaciones de tipos estrictas para evitar problemas de linter.
- **Sincronización horaria:** Se corrigieron los constructores de fechas en el frontend forzando el formato ISO `YYYY-MM-DDTHH:mm:ss-05:00`.

### Errores detectados y Lecciones aprendidas (2026-07-01)

- **Error de Linter/Build:** Pre-commit hooks fallaron inicialmente debido a una referencia no importada (`Clock` en `CalendarView.tsx`) y uso del tipo implícito `any` en `UserRequestForm.tsx`.
- **Solución/Lección:** Siempre importar todos los componentes/iconos utilizados y definir contratos de interfaz estrictos (`TodayReservation`) en lugar de evadir el chequeo con `any` en TS.
- **Desfase Horario:** Crear fechas con `new Date("YYYY-MM-DDTHH:mm")` delega la interpretación al huso horario local de la máquina del cliente, causando desfases en bases de datos centralizadas o servidores con diferente hora base (UTC).
- **Solución/Lección:** Incluir siempre el offset de la zona horaria objetivo (ej: `-05:00`) para garantizar consistencia.

### Pendientes (2026-07-01)

- Continuar con el rediseño tipográfico de la plataforma importando Plus Jakarta Sans.
