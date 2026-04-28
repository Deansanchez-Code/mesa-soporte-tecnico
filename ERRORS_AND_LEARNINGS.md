# Errores y Aprendizajes (Errors & Learnings)

## [Error] Fallo de Build en Vercel por Zod

- **Causa:** Validación estricta de variables de entorno en tiempo de compilación.
- **Aprendizaje:** Las validaciones de entorno deben ser conscientes del ciclo de vida (build vs runtime). Se aprendió a usar `process.env.npm_lifecycle_event === 'build'` para condicionar validaciones.

## [Error] Pérdida de Nonce en Middleware de Supabase

- **Causa:** Al actualizar la sesión en el middleware, se creaba un nuevo objeto `NextResponse` que no incluía las cabeceras modificadas (`x-nonce`) del middleware principal.
- **Aprendizaje:** Es necesario pasar explícitamente los `requestHeaders` a las funciones que generan respuestas en el middleware para asegurar la persistencia de las cabeceras de seguridad.

## [Aprendizaje] Lógica de Festivos en Colombia

- **Contexto:** Cálculo de fechas de vencimiento.
- **Aprendizaje:** Se implementó el cálculo del Domingo de Ramos/Pascua para determinar festivos móviles y se aplicó la lógica de traslado de festivos al lunes siguiente (Ley Emiliani).

## [Error] Error de Sintaxis en Resolución de Conflictos (Git Merge)

- **Causa:** Durante la resolución manual de conflictos en `src/env.ts`, se eliminó accidentalmente la firma de una función de flecha en un `.refine()`.
- **Aprendizaje:** Tras resolver conflictos manualmente, es imperativo realizar una revisión visual de la sintaxis y ejecutar el linter antes de intentar el commit definitivo. Los pre-commit hooks (Husky/Lint-staged) son la última línea de defensa efectiva.

## [Aprendizaje] Trazabilidad vs Limpieza (Hard vs Soft Delete)

- **Contexto:** Eliminación automática de tickets al cancelar reservas.
- **Aprendizaje:** La eliminación física (`.delete()`) es perjudicial para la auditoría y el análisis de negocio. Se aprendió que en sistemas de soporte, cada acción debe quedar registrada mediante cambios de estado (`status: 'CANCELADO'`) y notas automáticas, garantizando que el historial siempre sea consultable desde el dashboard de administración.
