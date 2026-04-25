# Registro de Decisiones (Decisions Log)

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
