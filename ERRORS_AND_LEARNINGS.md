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

- **Causa:** Uso de comparación estricta (!==) entre el auditorium_id de la base de datos (a veces numérico) y el estado del formulario (string).
- **Aprendizaje:** Al trabajar con datos que pueden ser polimórficos entre la base de datos y el estado de React, es fundamental normalizar los tipos (usando String() o Number()) antes de realizar comparaciones críticas. Esto evitaba que los usuarios vieran bloqueos de horario que técnicamente existían.

## [Error] Desfase Horario en Creación de Reservas y Notificaciones de Correo

- **Causa:** El uso del constructor de Date en el cliente `new Date("YYYY-MM-DDTHH:mm")` interpreta la fecha bajo la zona horaria del sistema del navegador del cliente, lo que causaba un desfase de horas al convertirse al formato ISO/UTC al guardarse en base de datos y generar los correos en el servidor.
- **Aprendizaje:** Al trabajar con fechas orientadas a un huso horario específico (como Colombia `America/Bogota`), se debe forzar el offset de la zona horaria (ej: `-05:00`) en el constructor para evitar diferencias relativas de tiempo entre el cliente y el servidor.

## [Error] Fallo en pre-commit hook por importaciones faltantes y tipo `any` en ESLint

- **Causa:** Uso del icono `Clock` en el código sin importarlo de la librería correspondiente, y paso de variables tipadas como `any` en funciones de filtrado, lo que detuvo el commit automático por las validaciones estrictas del hook Husky.
- **Aprendizaje:** Se debe estructurar un contrato de tipo robusto (`interface`) para respuestas asíncronas complejas en lugar de optar por `any` rápido, y siempre correr validaciones de linter locales (`eslint --fix`) antes de proceder con confirmaciones.
