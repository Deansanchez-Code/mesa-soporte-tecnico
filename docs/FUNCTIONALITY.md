# Documentación de Funcionalidad

Este documento describe las principales características y módulos de la plataforma **Mesa de Ayuda TIC**.

## 1. Autenticación y Roles

El sistema cuenta con un control de acceso basado en roles (RBAC):

- **Super Admin**: Acceso total a todas las funcionalidades, configuración del sistema y gestión de usuarios.
- **Agente (Técnico)**: Gestión de tickets, inventario y visualización de métricas.
- **Usuario (Funcionario)**: Acceso limitado al portal público para crear tickets y reservar auditorios.

## 2. Panel de Control (Admin Dashboard)

Centro de operaciones para Administradores y Agentes.

### Gestión de Funcionarios (Staff Management)

- **Listado de Funcionarios**: Visualización de todos los usuarios con rol 'user'.
- **Creación Individual**: Formulario para registrar nuevos funcionarios con asignación automática de contraseña por defecto.
- **Carga Masiva**: Importación de usuarios desde archivos Excel/CSV.
- **Gestión de Ubicaciones**: Asignación de áreas/ubicaciones desde un catálogo centralizado.

### Gestión de Activos (Inventario)

- **Registro de Equipos**: Alta de activos con serial, marca, modelo y tipo.
- **Asignación**: Vinculación de equipos a funcionarios responsables.
- **Códigos QR**: Generación de etiquetas QR por ubicación para reporte rápido de fallas.
- **Trazabilidad**: Historial completo de movimientos, asignaciones y reparaciones de cada activo.
- **Acciones**: Funcionalidades para trasladar activos entre usuarios o darlos de baja.

### Mesa de Ayuda (Tickets)

- **Gestión de Casos**: Vista kanban o lista de tickets por estado (Pendiente, En Progreso, Resuelto).
- **SLA**: Seguimiento de tiempos de respuesta y resolución.
- **Métricas**: Gráficos de rendimiento por agente, categoría y estado de tickets.

### Configuración

- **Catálogos**: Gestión de Áreas y Categorías de tickets.

## 3. Portal Público

Interfaz simplificada para usuarios finales.

- **Reporte de Fallas**: Formulario sencillo para crear tickets, escaneando QR o manual.
- **Consulta de Estado**: Verificación del estado de sus tickets reportados.

## 4. Reserva de Auditorios

Módulo para la gestión de espacios comunes.

- **Calendario Interactivo**: Visualización de disponibilidad por día/semana.
- **Formulario de Reserva**: Solicitud de espacio con selección de horario y recursos (Video Beam, Sonido, PC).
- **Validaciones**: Prevención de conflictos de horario y validación de disponibilidad de agentes para soporte.
