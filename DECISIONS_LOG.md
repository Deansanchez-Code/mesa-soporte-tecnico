# Registro de Decisiones (Decisions Log)

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
