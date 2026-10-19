# Registro de Decisiones (Decisions Log)

## ADR-010: Habilitación de Reserva para Ambiente 107 con Flujo de Aprobación por Coordinación y Notificaciones Humanizadas

**Fecha:** 2026-10-18
**Capa:** Lógica de Negocio / Frontend / Comunicaciones / Email
**Responsable:** Arquitecto de Software Principal
**Estado:** Aceptada

### Contexto (ADR-010)

1. Se solicitó habilitar la reserva del **Ambiente 107**, con un flujo análogo a la Biblioteca: los instructores y personal de planta prereservan en estado `PENDING`, mientras que administradores y VIPs se aprueban de forma inmediata.
2. La autorización y gestión de estas solicitudes debe ser ejercida exclusivamente por la funcionaria Norma Barrera (`nbarrerac@sena.edu.co`).
3. Se requería estandarizar correos transaccionales con tecnología robusta (+15,000 ⭐ en GitHub, implementada con `@react-email/components`), aplicando UX Writing humanizado y empático.

### Decisión (ADR-010)

1. **Identificador de Espacio:** Se asigna `auditorium_id: "4"` al Ambiente 107.
2. **Control de Acceso y Aprobaciones:**
   - Se crea [`ambiente107ApprovalActions.ts`](file:///d:/mesa-soporte-tecnico/src/features/reservations/actions/ambiente107ApprovalActions.ts) restringido a `nbarrerac@sena.edu.co` (y administrador de respaldo).
   - Se crea el componente interactivo [`Ambiente107ApprovalModal.tsx`](file:///d:/mesa-soporte-tecnico/src/features/reservations/components/Ambiente107ApprovalModal.tsx) montado en el Dashboard del usuario cuando coincide con la credencial de coordinación.
3. **Comunicaciones Humanizadas y Correos:**
   - Se crea la plantilla [`SpaceReservationEmail.tsx`](file:///d:/mesa-soporte-tecnico/src/lib/email/templates/SpaceReservationEmail.tsx) con React Email, badges semánticos, diseño institucional y redacción empática.
4. **Skills Especializadas Documentadas:**
   - `humanized-ux-writing`: Guía de microcopia empática y mensajes constructivos.
   - `transactional-email-design`: Estándares de maquetación de correos compatibles universalmente con React Email.
5. **Frontend & UX:**
   - Se habilita el selector en [`AuditoriumReservationForm.tsx`](file:///d:/mesa-soporte-tecnico/src/features/reservations/components/AuditoriumReservationForm.tsx).
   - Se añade la tarjeta interactiva y badge en "Eventos de Hoy" en [`UserRequestForm.tsx`](file:///d:/mesa-soporte-tecnico/src/features/requests/components/UserRequestForm.tsx).
   - Se integra en [`useAssignments.ts`](file:///d:/mesa-soporte-tecnico/src/features/assignments/hooks/useAssignments.ts) para visibilidad en el calendario de ambientes.

### Consecuencias (ADR-010)

- **Positivas:** Control pedagógico centralizado para el Ambiente 107; prevención de conflictos de horario; comunicación transparente y empática hacia el usuario solicitante; cero dependencias externas no auditadas.
- **Negativas:** Ninguna.

---

## ADR-009: Estandarización de Skills de Proyecto para Supabase Security/Ops y Playwright E2E

**Fecha:** 2026-10-18
**Capa:** Arquitectura / Gobernanza Operativa / QA
**Responsable:** Arquitecto de Software Principal
**Estado:** Aceptada

### Contexto (ADR-009)

Se requería consolidar las capacidades operativas y de testing del proyecto `mesa-soporte-tecnico`, estandarizando los lineamientos para:

1. Seguridad rigurosa en Supabase (denegación por defecto, Row Level Security, prevención de fugas de `service_role`, sincronización estricta de tipos en Next.js 16 con `@supabase/ssr`).
2. Pruebas de integración E2E con Playwright para flujos sensibles (autenticación, validación de conflictos de reservas y roles VIP).

### Decisión (ADR-009)

Se formalizan e implementan en `.agents/skills/` dos skills locales especializadas:

1. `supabase-security-and-ops`: Protocolos de seguridad RLS, gestión de sesiones con `getUser()`, validación de esquemas Zod y comandos de migración/tipos.
2. `playwright-e2e-testing`: Estándares de testing sin esperas frágiles, aserciones basadas en accesibilidad y scripts de ejecución rápida y modo trace.

### Consecuencias (ADR-009)

- **Positivas:** Estandarización técnica ejecutable por el equipo y agentes IA; prevención de errores de autorización y regresiones funcionales en flujos de reserva.
- **Negativas:** Ninguna.

---

## ADR-008: Gestión de Mantenimiento / Pausa de Espacios y Optimización de Reservas Semanales

**Fecha:** 2026-08-29
**Capa:** Lógica de Negocio / Base de Datos / UI
**Responsable:** Tech Lead / Fullstack Engineer
**Estado:** Aceptada

### Contexto (ADR-008)

1. Ante remodelaciones o mantenimientos físicos en el Auditorio, se requería una vía para pausar la creación de reservas a partir de una fecha determinada, informar a los usuarios con un mensaje institucional (disculpas y escalamiento a Coordinación Académica/Formación) y aplicar la regla de bloqueo por el resto de la vigencia 2026 cuando no haya fecha final.
2. Las reservas semanales presentaban problemas de consulta en rango de semanas y falsos positivos de conflicto visual al no evaluar las fechas exactas de las sesiones programadas.

### Opciones Consideradas (ADR-008)

1. **Hardcoding de fechas en el código:** Rápido de desplegar pero inflexible ante cambios de cronograma de obras.
2. **Configuración dinámica en `system_settings` con validación multi-nivel:** Almacenar el estado en base de datos (`auditorium_maintenance`), exponer su control al panel de administración y validar concurrentemente en la interfaz y en Server Actions.

### Decisión (ADR-008)

- Se crea la clave `auditorium_maintenance` en `system_settings` con soporte para `start_date`, `end_date` opcional y bandera `is_active`.
- Se bloquea en el selector inicial con un modal informativo (`AuditoriumMaintenanceModal.tsx`), en el formulario (`AuditoriumReservationForm.tsx`) y en las acciones del servidor (`reservationActions.ts`).
- Se reestructura la comprobación de conflictos para evaluar únicamente conjuntos de fechas puntuales (`targetDates`).
- **Barrido automático de cancelaciones:** Al activar la pausa, el backend cancela todas las reservas activas en el rango y despacha un solo correo consolidado por cada usuario afectado (`MaintenanceCancellationNotification.tsx`) en lugar de saturar la bandeja con un correo individual por reserva.
- **Cancelación en Bandeja de Técnicos:** Todos los tickets de soporte activos vinculados a las reservas canceladas pasan a estado `CANCELADO` con su correspondiente evento de auditoría en `ticket_events`.

### Consecuencias (ADR-008)

- **Positivas:** Control total para los administradores sin necesidad de nuevos despliegues de código; información clara y transparente a los usuarios; prevención de reservas indebidas durante obras.
- **Negativas:** Ninguna identificada.

---

## ADR-006: Transición de Hard Delete a Soft Update (Estados) en Tickets de Soporte

**Fecha:** 2026-04-28
**Capa:** Lógica de Negocio / Base de Datos
**Responsable:** Tech Lead / Agente Senior
**Estado:** Aceptada

### Contexto (ADR-006)

El sistema eliminaba físicamente (`.delete()`) los tickets de soporte generados automáticamente al cancelar una reserva de auditorio o biblioteca. Esto provocaba una pérdida de trazabilidad histórica: en el dashboard de administración, el ticket simplemente desaparecía, impidiendo auditorías sobre por qué se canceló una solicitud o cuántas cancelaciones ocurren.

### Opciones Consideradas (ADR-006)

1. **Mantener eliminación física:** Mantiene la base de datos limpia pero sin historial (Descartado).
2. **Cambio a estado `CANCELADO` (Soft Update):** Actualizar el estado del ticket y mantenerlo en la base de datos con una nota descriptiva de la razón del cierre.

### Decisión (ADR-006)

Se implementa la opción 2. Los tickets asociados a reservas canceladas pasan al estado `CANCELADO`. Además, se concatena en el campo `description` una nota de trazabilidad indicando la fecha, hora y el actor (Usuario, VIP o Administrador) que originó la cancelación.

### Consecuencias (ADR-006)

- **Positivas:** Trazabilidad completa del ciclo de vida del ticket. Posibilidad de generar métricas sobre cancelaciones. Mejor UX para el administrador al no ver "registros fantasma" que desaparecen.
- **Negativas:** Ligero incremento en el volumen de datos de la tabla `tickets` (despreciable frente al beneficio de la auditoría).

---

## ADR-005: Reforzamiento de Políticas RLS para Privacidad de Datos

**Fecha:** 2026-04-27
**Capa:** Base de Datos / Seguridad
**Responsable:** Arquitecto de Software / Agente Senior
**Estado:** Propuesta

### Contexto (ADR-005)

Durante la auditoría de seguridad de la Fase 2, se detectaron políticas RLS excesivamente permisivas en tablas con datos sensibles. Específicamente, las tablas `assets`, `asset_events` y `users` permiten lectura total (`USING (true)`) a cualquier usuario autenticado, lo que expone inventarios, correos electrónicos y trazabilidad interna a roles que no lo requieren (ej. contratistas).

### Opciones Consideradas (ADR-005)

1. **Mantener actual:** Facilita la depuración pero compromete la privacidad (No recomendado).
2. **Restricción por Rol y Pertenencia:** Limitar la visibilidad de activos a sus dueños o personal de soporte, y restringir la visibilidad de usuarios a columnas públicas.

### Decisión (ADR-005)

Se propone implementar las siguientes restricciones:

- **`assets`:** Solo lectura para el usuario asignado (`assigned_to_user_id`) o personal de soporte (`agent`, `admin`, `superadmin`).
- **`asset_events`:** Solo lectura para personal de soporte.
- **`users`:** Aplicar CLS (Column Level Security) también al rol `authenticated` para ocultar `email` y otros campos privados, permitiendo solo la visibilidad de perfiles públicos.

### Consecuencias (ADR-005)

- **Positivas:** Cumplimiento con estándares de privacidad y reducción de la superficie de ataque interna.
- **Negativas:** Posible impacto en componentes de UI que dependan de la búsqueda global de activos (deben ser revisados).

---

## [2026-04-25] Validación de Variables de Entorno (SMTP)

- **Decisión:** Permitir que el proceso de build ignore la validación de Zod para `SMTP_USER` y `SMTP_PASS`.
- **Razón:** Vercel requiere realizar el build sin acceso a secrets de runtime en algunos flujos, y el bloqueo impedía despliegues exitosos.
- **Impacto:** Se garantiza que el build pase, pero se mantiene la validación estricta en tiempo de ejecución.

## [2026-04-25] Seguridad CSP con Nonces

- **Decisión:** Implementar la generación de _nonces_ criptográficos en el middleware y propagarlos a través de los encabezados de petición.
- **Razón:** Cumplir con una política de seguridad estricta que prohíba `'unsafe-inline'` y use `'strict-dynamic'`.
- **Impacto:** Mejora significativa en la protección contra ataques XSS.

## [2026-04-25] Lógica de SLA con Festivos de Colombia

- **Decisión:** Integrar el cálculo de festivos basado en la "Ley Emiliani" en el calculador de SLA.
- **Razón:** Los acuerdos de nivel de servicio deben ser realistas y respetar los días no laborales locales para evitar penalizaciones injustas en las métricas.
- **Impacto:** Mayor precisión en las fechas de vencimiento de los tickets.

## [2026-04-25] UX: Filtros de Criticidad y Alertas de SLA

- **Decisión:** Implementar un filtro dedicado para tickets "VIP" y un resaltado visual (ámbar pulsante) para tickets próximos a vencer (<1h).
- **Razón:** Facilitar a los agentes la identificación inmediata de tickets que requieren acción prioritaria para cumplir el SLA.
- **Impacto:** Reducción en el riesgo de incumplimiento de SLA y mejora en la eficiencia operativa.

## [2026-04-28] Mejora en Lógica de Reservas y Mitigación de Spam

- **Decisión:**
  1. Incluir el estado PENDING en todas las validaciones de conflicto de reserva.
  2. Implementar un parámetro silent en cancelReservationAction para omitir notificaciones individuales durante anulaciones masivas por prioridad VIP.
  3. Normalizar comparaciones de auditorium_id en el frontend para evitar fallos por discrepancia de tipos (String vs Number).
- **Razón:** Los usuarios reportaban reservas solapadas (debido a que las solicitudes pendientes no bloqueaban nuevos intentos) y saturación de correos (debido a notificaciones redundantes en procesos por lotes).
- **Impacto:** Eliminación de reservas duplicadas en el mismo horario, mejor visibilidad del estado real de ocupación y reducción drástica del ruido por correos electrónicos automáticos.
- **Responsable:** Arquitecto / Desarrollador Fullstack.
- **Estado:** Aceptado.

---

## ADR-007: Reestructuración Visual del Portal de Reservas, Sincronización Horaria y Modal de Autocierre

**Fecha:** 2026-07-01
**Capa:** Interfaz de Usuario (UI/UX) / Lógica de Negocio
**Responsable:** Agente Senior / Diseñador UX/UI
**Estado:** Aceptada

### Contexto (ADR-007)

1. El servicio de Soporte Técnico se gestionará de manera externa por canales de correo electrónico, por lo que la tarjeta en el panel de selección de servicios quedó obsoleta y causaba confusión.
2. Los usuarios que acceden desde celulares encontraban la cuadrícula del calendario demasiado densa y con desbordamiento de texto, lo que dificultaba la legibilidad y la interacción táctil.
3. Se reportaron discrepancias en las horas de reserva que figuraban en los correos electrónicos de confirmación en comparación con la hora del sistema, debido a que el objeto `Date` de Javascript se inicializaba sin forzar la zona horaria de Colombia (UTC-5), sufriendo desfases según la zona horaria del cliente o servidor.
4. Tras registrar una reserva de manera exitosa, el sistema solo mostraba una alerta en toast, sin dar un feedback detallado y estructurado de la reserva creada al usuario antes de redirigirlo.

### Opciones Consideradas (ADR-007)

1. **Mantener layouts planos y notificaciones básicas:** No resolvía los problemas de legibilidad móvil, el desfase horario ni la falta de confirmación visual del usuario.
2. **Reestructuración integral y calibración horaria:**
   - Reemplazar la tarjeta de soporte por un widget interactivo de "Eventos de Hoy".
   - Ocultar textos extensos en el calendario móvil y desplegar un resumen diario inline bajo la cuadrícula.
   - Forzar el offset `-05:00` en todas las conversiones e instanciaciones de Date en el formulario de reservas.
   - Agregar un modal de resumen de reserva con autocierre de 5 segundos tras un envío exitoso.

### Decisión (ADR-007)

Se implementa la opción 2 para mejorar la experiencia de usuario y robustez horaria global. Se rediseña el layout principal a 3 columnas sustituyendo soporte por el widget dinámico "Eventos de Hoy", se crea una versión responsive para el calendario de ambientes/reservas, se alinea la zona horaria en el front a UTC-5 y se añade el modal con cuenta regresiva.

### Consecuencias (ADR-007)

- **Positivas:**
  - Reducción del spam visual y mejora de usabilidad táctil en móviles.
  - Sincronización absoluta de horarios entre BD, formulario y correos.
  - Mayor feedback informativo al usuario que confirma visualmente los detalles de su reserva recién creada.
- **Negativas:** Ninguna.
