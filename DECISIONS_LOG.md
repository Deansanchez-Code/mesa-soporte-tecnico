# Registro de Decisiones (Decisions Log)

## ADR-005: Reforzamiento de Políticas RLS para Privacidad de Datos

**Fecha:** 2026-04-27
**Capa:** Base de Datos / Seguridad
**Responsable:** Arquitecto de Software / Agente Senior
**Estado:** Propuesta

### Contexto

Durante la auditoría de seguridad de la Fase 2, se detectaron políticas RLS excesivamente permisivas en tablas con datos sensibles. Específicamente, las tablas `assets`, `asset_events` y `users` permiten lectura total (`USING (true)`) a cualquier usuario autenticado, lo que expone inventarios, correos electrónicos y trazabilidad interna a roles que no lo requieren (ej. contratistas).

### Opciones Consideradas

1. **Mantener actual:** Facilita la depuración pero compromete la privacidad (No recomendado).
2. **Restricción por Rol y Pertenencia:** Limitar la visibilidad de activos a sus dueños o personal de soporte, y restringir la visibilidad de usuarios a columnas públicas.

### Decisión

Se propone implementar las siguientes restricciones:

- **`assets`:** Solo lectura para el usuario asignado (`assigned_to_user_id`) o personal de soporte (`agent`, `admin`, `superadmin`).
- **`asset_events`:** Solo lectura para personal de soporte.
- **`users`:** Aplicar CLS (Column Level Security) también al rol `authenticated` para ocultar `email` y otros campos privados, permitiendo solo la visibilidad de perfiles públicos.

### Consecuencias

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
