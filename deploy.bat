
# Git commit and merge script
git add .
git commit -m "feat(reservas): Mejoras integrales en módulo de Biblioteca y UI

- Rediseño de la interfaz principal a 3 columnas para mejor usabilidad en escritorio.
- Implementación de 'LibraryApprovalModal' embebido en la vista principal para autorizaciones inmediatas.
- Corrección crítica de Row-Level Security (RLS): Las consultas de coordinación ahora utilizan cliente Admin ('getSupabaseAdmin') para esquivar bloqueos de permisos de lectura, manteniendo la validación de seguridad de correos en el servidor.
- Nuevo sistema de Notificaciones In-App: Avisos visuales (Toasts) implementados para alertar a creadores cuando su reserva es aprobada (verde), cancelada (rojo) o se le sugiere modificación (amarillo).
- Resolución de bug en redirección de administradores al iniciar sesión.
- Nueva plantilla de correo específica para biblioteca, sin revelar información sensible."

# Push changes to developer branch first
git push origin developer

# Checkout main, merge and push
git checkout main
git merge developer
git push origin main

# Return to developer branch
git checkout developer
