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
