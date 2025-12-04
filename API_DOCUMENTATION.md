# Documentación de API y Base de Datos

Este proyecto utiliza **Supabase** como backend (PostgreSQL). La interacción se realiza principalmente a través del cliente de Supabase (`@supabase/supabase-js`) directamente desde el frontend (Next.js), utilizando Row Level Security (RLS) para la seguridad.

## Modelo de Datos (Tablas)

### 1. `users` (Usuarios)

Almacena la información de todos los usuarios del sistema: Administradores, Técnicos y Funcionarios.

| Columna                    | Tipo        | Descripción                                                       |
| :------------------------- | :---------- | :---------------------------------------------------------------- |
| `id`                       | `uuid`      | Identificador único (Primary Key).                                |
| `full_name`                | `text`      | Nombre completo del usuario.                                      |
| `username`                 | `text`      | Nombre de usuario para inicio de sesión (único).                  |
| `password`                 | `text`      | Contraseña (en texto plano para este MVP, se recomienda hashear). |
| `role`                     | `text`      | Rol del usuario: `'admin'`, `'agent'`, `'user'`.                  |
| `area`                     | `text`      | Área o departamento al que pertenece.                             |
| `is_active`                | `boolean`   | Estado del usuario (Activo/Inactivo).                             |
| `is_vip`                   | `boolean`   | Indica si el usuario tiene prioridad (VIP).                       |
| `perm_create_assets`       | `boolean`   | Permiso para crear activos (solo agentes/admins).                 |
| `perm_transfer_assets`     | `boolean`   | Permiso para trasladar activos.                                   |
| `perm_decommission_assets` | `boolean`   | Permiso para dar de baja activos.                                 |
| `created_at`               | `timestamp` | Fecha de creación.                                                |

### 2. `assets` (Activos/Inventario)

Inventario de equipos tecnológicos.

| Columna               | Tipo        | Descripción                                   |
| :-------------------- | :---------- | :-------------------------------------------- |
| `id`                  | `bigint`    | Identificador único.                          |
| `serial_number`       | `text`      | Número de serie del equipo (único).           |
| `type`                | `text`      | Tipo de equipo (ej. Portátil, PC, Impresora). |
| `brand`               | `text`      | Marca.                                        |
| `model`               | `text`      | Modelo.                                       |
| `location`            | `text`      | Ubicación física del equipo.                  |
| `assigned_to_user_id` | `uuid`      | FK a `users`. Usuario responsable del equipo. |
| `created_at`          | `timestamp` | Fecha de registro.                            |

### 3. `tickets` (Mesa de Ayuda)

Solicitudes de soporte técnico.

| Columna             | Tipo        | Descripción                                                                       |
| :------------------ | :---------- | :-------------------------------------------------------------------------------- |
| `id`                | `bigint`    | Identificador único.                                                              |
| `user_id`           | `uuid`      | FK a `users`. Usuario que reporta el caso.                                        |
| `assigned_agent_id` | `uuid`      | FK a `users`. Técnico asignado.                                                   |
| `status`            | `text`      | Estado: `'PENDIENTE'`, `'EN_PROGRESO'`, `'RESUELTO'`, `'EN_ESPERA'`, `'CERRADO'`. |
| `category`          | `text`      | Categoría del problema (Hardware, Software, Red, etc.).                           |
| `location`          | `text`      | Ubicación donde ocurre el incidente.                                              |
| `description`       | `text`      | Descripción detallada del problema.                                               |
| `created_at`        | `timestamp` | Fecha de creación.                                                                |
| `updated_at`        | `timestamp` | Fecha de última actualización.                                                    |

### 4. `reservations` (Reserva de Auditorios)

Gestión de reservas para espacios comunes.

| Columna      | Tipo        | Descripción                                            |
| :----------- | :---------- | :----------------------------------------------------- |
| `id`         | `bigint`    | Identificador único.                                   |
| `title`      | `text`      | Título o motivo de la reserva.                         |
| `start_time` | `timestamp` | Fecha y hora de inicio.                                |
| `end_time`   | `timestamp` | Fecha y hora de fin.                                   |
| `user_id`    | `uuid`      | FK a `users`. Usuario que reserva.                     |
| `status`     | `text`      | Estado de la reserva (ej. `'confirmed'`, `'pending'`). |
| `resources`  | `json/text` | Recursos solicitados (Proyector, Sonido, etc.).        |
| `created_at` | `timestamp` | Fecha de creación.                                     |

### 5. `audit_logs` (Auditoría)

Registro de acciones críticas para trazabilidad.

| Columna        | Tipo        | Descripción                                                |
| :------------- | :---------- | :--------------------------------------------------------- |
| `id`           | `bigint`    | Identificador único.                                       |
| `action`       | `text`      | Acción realizada (ej. `'CREATE'`, `'UPDATE'`, `'DELETE'`). |
| `entity`       | `text`      | Entidad afectada (ej. `'users'`, `'assets'`).              |
| `entity_id`    | `text`      | ID de la entidad afectada.                                 |
| `details`      | `json`      | Detalles adicionales del cambio.                           |
| `performed_by` | `uuid`      | FK a `users`. Usuario que realizó la acción.               |
| `created_at`   | `timestamp` | Fecha del evento.                                          |

### 6. Tablas Auxiliares

- **`areas`**: Catálogo de áreas/departamentos (`id`, `name`).
- **`categories`**: Catálogo de categorías de tickets (`id`, `name`).
- **`asset_transfers`**: Historial de traslados de activos.

## Seguridad (RLS)

Se han configurado políticas de Row Level Security para asegurar que:

- Los usuarios normales solo puedan ver sus propios tickets y reservas.
- Los agentes y administradores tengan acceso global a tickets, activos y usuarios para gestión.
- Solo los administradores puedan gestionar configuraciones críticas.
