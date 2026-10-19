---
name: supabase-security-and-ops
description: Directrices, procedimientos y patrones de seguridad para Supabase en Next.js (App Router). Incluye auditoría de Row Level Security (RLS), gestión segura de sesiones con @supabase/ssr, prevención de bypass con service_role, sincronización de tipos TypeScript y migraciones reproducibles con rollback.
---

# Supabase Security & Operations Guide

Guía operativa y de arquitectura de seguridad para integraciones de Supabase en Next.js 16 con App Router.

## 1. Principios de Seguridad Esenciales

1. **Denegación por Defecto (Zero Trust):**
   - Toda tabla creada en Supabase DEBE tener `ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;`.
   - Si no existe una política explícita (`CREATE POLICY`), el acceso a lectura y escritura queda completamente bloqueado para el rol `authenticated` y `anon`.

2. **Aislamiento de Claves:**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Solo para operaciones públicas o de cliente sujetas a RLS.
   - `SUPABASE_SERVICE_ROLE_KEY`: **ESTRICTAMENTE PROHIBIDO** exponerla al cliente o importarla en componentes que no sean Server Actions o Route Handlers seguros de backend. Su uso bypasséa todas las políticas RLS.

3. **Validación Previa con Esquemas (Zod):**
   - Nunca confiar en los datos enviados desde formularios cliente o payloads JSON.
   - Validar con esquemas de Zod antes de ejecutar cualquier mutación (`insert`, `update`, `delete`).

---

## 2. Patrones de Código Recomendados

### A. Cliente SSR en Server Components y Server Actions

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // El método `setAll` fue invocado desde un Server Component.
            // Esto puede ignorarse si hay un middleware refrescando sesiones.
          }
        },
      },
    },
  );
}
```

### B. Políticas RLS Críticas

#### 1. Consulta Aislada por Propietario / Organización

```sql
-- Habilitar RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Política de lectura para el creador o administradores
CREATE POLICY "Users can view own reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor')
  )
);
```

#### 2. Inserción con Verificación de Identidad

```sql
CREATE POLICY "Users can create reservations for themselves"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);
```

---

## 3. Flujo de Trabajo y Operaciones

### Sincronización de Tipos TypeScript

Tras cualquier modificación en las tablas o esquemas remotos/locales de Supabase:

```bash
# Sincronizar definiciones de tipos en src/types/database.types.ts
pnpm types:sync
```

### Comprobación de Migraciones

1. Cada cambio estructural de base de datos debe residir en `supabase/migrations/<timestamp>_<descripcion>.sql`.
2. Las migraciones deben ser idempotentes (`IF NOT EXISTS`, `OR REPLACE`).
3. Todo cambio destructivo (`DROP`, `ALTER COLUMN TYPE`) debe prever plan de migración de datos y script de reversión (rollback).

---

## 4. Checklist de Auditoría RLS

- [ ] ¿Todas las tablas públicas tienen RLS activo? (`pg_tables` con `rowsecurity = true`).
- [ ] ¿Están restringidas las operaciones `UPDATE` y `DELETE` para evitar manipulación cruzada de registros?
- [ ] ¿Se valida la sesión en el middleware (`src/lib/supabase/middleware.ts`) refrescando tokens con `getUser()` en lugar de solo leer `getSession()`?
- [ ] ¿Los campos críticos (como `role`, `is_approved`, `credits`) están protegidos de edición por parte del usuario estándar?
- [ ] ¿Existe rate-limiting o validación de conflictos (como solapamiento de fechas) a nivel de base de datos o Server Action transaccional?
