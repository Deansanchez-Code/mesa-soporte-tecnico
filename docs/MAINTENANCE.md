# Guía de Mantenimiento y Estabilización

Esta guía detalla las acciones recomendadas para mantener la salud, seguridad y rendimiento del proyecto `mesa-soporte-tecnico` a largo plazo.

## 1. Mantenimiento de Dependencias

Mantener las librerías actualizadas es crucial para evitar vulnerabilidades de seguridad y bugs.

- **Acción:** Ejecutar auditoría semanalmente.
- **Comando:** `pnpm audit`
- **Script Recomendado:** Agregar `"audit": "pnpm audit --fix"` al `package.json`.

### Automatización en `package.json`

Se añadirán los siguientes scripts para facilitar el mantenimiento:

```json
"audit": "pnpm audit",
"db:dump": "supabase db dump > database/dumps/backup_$(date +%F).sql",
"types:sync": "supabase gen types typescript --project-id \"$SUPABASE_PROJECT_ID\" > app/admin/types.ts",
"test:all": "vitest run"
```

## 2. Respaldo de Base de Datos

Aunque Supabase realiza backups automáticos, se recomienda tener copias locales de la estructura y datos críticos.

- **Acción:** Realizar dumps periódicos del esquema.
- **Comando:** `supabase db dump > database/dumps/backup_$(date +%F).sql`
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
- **Comando:** `supabase gen types typescript --project-id "tu-project-id" > app/admin/types.ts` (Ajustar ruta según corresponda).

## 6. Monitoreo en Producción

- **Logs:** Usar el `Logger` implementado (`lib/logger.ts`) para trazar errores críticos.
- **Servicio Externo:** Considerar integrar Sentry o LogRocket para monitoreo de errores en tiempo real en el frontend.

## 7. Performance

- **Lazy Loading:** Continuar usando `React.lazy` para modales pesados.
- **Imágenes:** Usar siempre `<Image />` de Next.js en lugar de `<img>`.
- **Bundle Analysis:** Ejecutar `ANALYZE=true next build` periódicamente para detectar dependencias gigantes.

---

**Nota:** Estas acciones deben ser parte del ciclo de vida del desarrollo (Sprint Review/Maintenance).
