# Quality Gate (Criterios de Calidad)

## Git y Ramas

- Rama `main` protegida.
- Flujo obligatorio: `feature/`, `fix/`, `chore/`, `hotfix/`.
- Commits convencionales en español: `tipo(alcance): descripcion`.
- Merge a `main` solo vía Pull Request (o proceso equivalente validado).

## Código y Estándares

- **Linting:** ESLint obligatorio (sin errores antes de commit).
- **TypeScript:** No se permite el uso de `any` injustificado; tipado estricto.
- **Arquitectura:** Respetar la separación por _features_.

## Pruebas

- **Unitarias:** Críticas para lógica de dominio (SLA, Helpers).
- **E2E:** Obligatorias para flujos críticos (Creación de tickets, Login, Gestión VIP).
- **Cobertura:** No se aceptan regresiones en flujos ya probados.

## Seguridad

- CSP activado con Nonce.
- Validación de entrada en todos los formularios con Zod.
- RLS (Row Level Security) activo en Supabase para todas las tablas.
