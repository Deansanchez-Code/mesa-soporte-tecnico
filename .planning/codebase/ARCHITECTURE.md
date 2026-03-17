# Arquitectura

**Fecha de Análisis:** 2026-03-17

## Descripción General del Patrón

**En general:** Aplicación Next.js Full-stack con Modularidad Basada en Características (Features).

**Características Clave:**

- **App Router:** Renderizado híbrido (componentes de servidor y cliente).
- **Basado en Características:** La lógica está encapsulada dentro de `src/features/[nombre-del-feature]`.
- **Server Actions:** Método principal para mutaciones y envío de datos.
- **Centrado en Supabase:** Gran dependencia de Supabase para Autenticación, Base de Datos y Realtime.

## Capas

**Capa de UI (Componentes de React):**

- Propósito: Renderizar interfaces y manejar la interacción del usuario.
- Contiene: Componentes de Servidor (`src/app`), Componentes de Cliente (`src/features/*/components`).
- Depende de: Hooks para estado/lógica, Acciones para mutaciones.
- Utilizado por: Usuarios finales.

**Capa de Lógica (Hooks Personalizados):**

- Propósito: Gestionar el estado del lado del cliente y la orquestación de la obtención de datos.
- Contiene: Hooks de React Query.
- Ubicación: `src/features/*/hooks`.
- Depends on: Servicios o cliente directo de Supabase.
- Used by: UI Components.

**Capa de Servidor (Acciones y Servicios):**

- Propósito: Ejecutar lógica de negocio y mutaciones de base de datos en el servidor.
- Contiene: Server Actions (`src/features/*/actions`), Servicios de Negocio (`src/features/*/services`).
- Depende de: Cliente de Supabase, utilidades de la librería (Lib).
- Utilizado por: Envíos de formularios, controladores de clics (vía Hooks).

**Capa de Datos (Supabase/PostgreSQL):**

- Propósito: Almacenamiento persistente y autenticación.
- Contiene: Tablas, Vistas, Políticas de RLS.
- Gestionado vía: `supabase/migrations`.

## Flujo de Datos

**Flujo de Mutación Típico (ej., Creación de un Ticket):**

1. **Entrada:** El usuario envía un formulario en un componente de Ticket.
2. **Hook:** El hook `useCreateTicket` llama a la acción del servidor.
3. **Acción:** `createTicketAction` (`src/features/tickets/actions/`) valida la entrada con Zod.
4. **Servicio:** La acción llama a `TicketService` (`src/features/tickets/services/`) para interactuar con Supabase.
5. **DB:** Supabase ejecuta la inserción y comprueba las políticas de RLS.
6. **Resultado:** El éxito o error burbujea de vuelta a la UI para actualizar el estado (ej., vía invalidación de React Query).

**Gestión de Estado:**

- **Estado del Servidor:** Manejado por TanStack Query.
- **Estado del Cliente:** React `useState`/`useContext` donde sea necesario.
- **Estado de Autenticación:** Gestionado por el middleware de Supabase SSR y proveedores de contexto.

## Abstracciones Clave

**Módulo de Característica (Feature Module):**

- Propósito: Encapsular todo lo relacionado con una entidad del dominio.
- Ejemplos: `src/features/assets`, `src/features/tickets`.
- Patrón: Estructura modular que contiene sus propios componentes, hooks y acciones.

**Cliente de Supabase:**

- Propósito: Interfaz unificada para BD, Autenticación y Almacenamiento.
- Patrón: Inicializado vía `@supabase/ssr` para contextos de servidor/cliente.

## Puntos de Entrada

**Entrada Web:**

- Ubicación: `src/app/layout.tsx` y `src/app/page.tsx`.
- Responsabilidades: Inicializar proveedores (QueryClient, Auth), renderizar el diseño raíz (root layout).

**Middleware:**

- Ubicación: `src/middleware.ts`.
- Responsabilidades: Actualización de sesión, encabezados de seguridad (CSP), redirección de rutas protegidas.

## Manejo de Errores

**Estrategia:** Validación con Zod en el límite, try/catch en acciones, notificaciones (toasts) de Sonner para retroalimentación en la UI.

---

_Análisis de arquitectura: 2026-03-17_
_Actualizar cuando cambien los patrones principales_
