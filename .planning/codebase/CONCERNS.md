# Preocupaciones de la Base de Código

**Fecha de Análisis:** 2026-03-17

## Deuda Técnica

**Configuración SMTP Opcional:**

- Problema: `SMTP_USER` y `SMTP_PASS` están marcados como opcionales en `src/env.ts`.
- Por qué: Para permitir que la aplicación se construya/ejecute sin una configuración de correo local.
- Impacto: Fallos silenciosos en las notificaciones por correo si faltan las variables de entorno en producción.
- Enfoque de solución: Hacerlas obligatorias para las construcciones de producción en `src/env.ts`.

**Lógica de Cálculo de SLA:**

- Problema: Cálculo manual de las fechas de vencimiento y horas de SLA.
- Por qué: Requisitos de negocio personalizados para usuarios VIP y categorías específicas.
- Impacto: Alta complejidad y potencial de errores en `src/lib/domain/sla-calculator.ts`.
- Enfoque de solución: Añadir pruebas unitarias extensas para todos los casos de borde (festivos, fines de semana, etc.).

## Consideraciones de Seguridad

**Política de Seguridad de Contenido (CSP):**

- Riesgo: Uso de `'unsafe-inline'` y `'unsafe-eval'` en `src/middleware.ts`.
- Mitigación actual: Permitido para la hidratación de Next.js y compatibilidad de librerías.
- Recomendaciones: Implementar nonces para scripts y estilos para eliminar `'unsafe-inline'`.

**URL de Supabase Expuesta:**

- Riesgo: Exposición potencial de la estructura interna del proyecto Supabase a través del cliente público.
- Mitigación actual: Políticas de RLS en la base de datos.
- Recomendaciones: Auditar todas las políticas de RLS para asegurar que no haya fugas de datos no autorizadas.

## Áreas Frágiles

**Orden del Middleware:**

- Por qué es frágil: La lógica de CSP y de actualización de sesión en `src/middleware.ts` es sensible al orden.
- Fallos comunes: Los cambios en el enrutamiento o en el emparejamiento de activos pueden saltarse accidentalmente los encabezados de seguridad.
- Modificación segura: Probar cuidadosamente la regex de emparejamiento de activos al añadir nuevas rutas públicas.

## Brechas en la Cobertura de Pruebas

**E2E Específico de Características:**

- Qué no está probado: Flujos de trabajo multietapa complejos como la escalada de tickets VIP.
- Riesgo: Los problemas de integración entre Supabase Realtime y la UI podrían pasar desapercibidos.
- Prioridad: Media.

---

_Auditoría de preocupaciones: 2026-03-17_
_Actualizar a medida que se solucionen los problemas o se descubran otros nuevos_
