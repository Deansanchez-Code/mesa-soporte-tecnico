# Guía de Mantenimiento y Estabilización

Esta guía detalla las acciones recomendadas para mantener la salud, seguridad y rendimiento del proyecto `mesa-soporte-tecnico` a largo plazo.

## 1. Mantenimiento de Dependencias

Mantener las librerías actualizadas es crucial para evitar vulnerabilidades de seguridad y bugs.

- **Acción:** Ejecutar auditoría semanalmente.
- **Comando:** `pnpm audit`
- **Script Recomendado:** Agregar `"audit": "pnpm audit --fix"` al `package.json`.

### Automatización en `package.json`

> **Nota Importante:** Para los comandos de base de datos (`db:dump` y `types:sync`), se utiliza un binario local de **Supabase CLI**.
>
> **Configuración Inicial:**
>
> 1. Ejecutar script de instalación (una sola vez): `node scripts/setup-supabase.js`
> 2. Loguearse en la CLI local: `scripts\bin\supabase.exe login`
> 3. **Requisito para Backups:** Tener instalada y ejecutándose la aplicación **Docker Desktop**.

Se han añadido los siguientes scripts para facilitar el mantenimiento:

```json
"audit": "pnpm audit",
"db:dump": "node scripts/db-backup.js",
"types:sync": "node scripts/types-sync.js",
"test:all": "vitest run"
```

## 2. Respaldo de Base de Datos

Aunque Supabase realiza backups automáticos, se recomienda tener copias locales de la estructura y datos críticos.

- **Acción:** Realizar dumps periódicos del esquema.
- **Comando:** `pnpm run db:dump`
- **Recomendación:** Automatizar esto mediante un GitHub Action o cron job si se despliega en infraestructura propia.

## 3. Calidad de Código (Linting & Formatting)

El proyecto ya cuenta con ESLint y Prettier. Es vital no ignorar las advertencias.

- **Política:** "Zero Warning Policy" en la rama principal.
- **Acción:** Correr `pnpm lint` antes de cada push importante.
- **Pre-commit:** Verificar que Husky esté ejecutando `lint-staged` correctamente (ya configurado).

## 4. Pruebas Automatizadas

Se dispone de Vitest, pero la cobertura debe expandirse.

- **Unitarias:** Crear tests para cada nuevo hook o utilidad en `utils/`.
- **Integración:** Probar flujos críticos (ej: crear ticket, cambiar estado) usando mocks de Supabase.
- **Comando:** `pnpm test`

## 5. Sincronización de Tipos (TypeScript & Supabase)

Para evitar errores de tipado manuales.

- **Acción:** Generar tipos automáticamente cuando cambie la DB.
- **Comando:** `pnpm run types:sync`

## 6. Monitoreo en Producción

- **Logs:** Usar el `Logger` implementado (`lib/logger.ts`) para trazar errores críticos.
- **Servicio Externo:** Considerar integrar Sentry o LogRocket para monitoreo de errores en tiempo real en el frontend.

## 7. Performance

- **Lazy Loading:** Continuar usando `React.lazy` para modales pesados.
- **Imágenes:** Usar siempre `<Image />` de Next.js en lugar de `<img>`.
- **Bundle Analysis:** Ejecutar `ANALYZE=true next build` periódicamente para detectar dependencias gigantes.

---

**Nota:** Estas acciones deben ser parte del ciclo de vida del desarrollo (Sprint Review/Maintenance).
