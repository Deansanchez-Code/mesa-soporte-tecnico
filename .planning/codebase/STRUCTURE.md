# Estructura de la Base de Código

**Fecha de Análisis:** 2026-03-17

## Diseño de Directorios

```
mesa-soporte-tecnico/
├── .agent/             # Recursos y habilidades del sistema GSD
├── .planning/          # Planificación del proyecto y mapeo de la base de código
├── public/             # Activos estáticos (imágenes, manifiesto, iconos)
├── src/                # Raíz del código fuente
│   ├── app/           # Next.js App Router (páginas y diseños)
│   ├── components/    # Componentes de UI compartidos/genéricos
│   ├── context/       # Contextos globales de React
│   ├── features/      # Características de negocio modulares
│   ├── hooks/         # Hooks de React compartidos
│   ├── lib/           # Utilidades y configuraciones compartidas
│   └── tests/         # Suite de pruebas globales
├── supabase/           # Configuración y migraciones de Supabase
└── package.json        # Manifiesto y dependencias
```

## Propósitos de los Directorios

**src/app/:**

- Propósito: Define las rutas y diseños (layouts) de la aplicación.
- Contiene: `page.tsx`, `layout.tsx` y directorios de rutas.

**src/features/:**

- Propósito: Lógica central organizada por dominio de negocio.
- Contiene: Subdirectorios para cada característica (ej., `tickets`, `assets`).
- Estructura Interna:
  - `actions/`: Lógica de servidor para mutaciones.
  - `components/`: Componentes de React específicos de la característica.
  - `hooks/`: Hooks específicos del dominio (principalmente React Query).
  - `services/`: Lógica de acceso a datos de bajo nivel.
  - `types.ts`: Definiciones de TypeScript para la característica.

**src/lib/:**

- Propósito: Utilidades compartidas, inicializadores de terceros y configuración central.
- Archivos clave: `logger.ts`, `env.ts`, `supabase/`.

**src/components/:**

- Propósito: Componentes de UI de propósito general (Botones, Entradas, Modales).
- Contiene: Componentes altamente reutilizables, no específicos de negocio.

## Ubicaciones de Archivos Clave

**Puntos de Entrada:**

- `src/app/page.tsx`: Entrada principal del dashboard/inicio.
- `src/middleware.ts`: Interceptor de peticiones global.

**Configuración:**

- `next.config.ts`: Ajustes de Next.js y configuración de PWA.
- `src/env.ts`: Validación de variables de entorno (Zod).
- `package.json`: Manifiesto de dependencias.

## Convenciones de Nombres

**Archivos:**

- `PascalCase.tsx`: Componentes de React.
- `camelCase.ts`: Utilidades, hooks y servicios.
- `kebab-case.ts`: Para scripts o archivos de configuración específicos si es necesario.
- `*.test.ts`: Archivos de prueba.

**Directorios:**

- `kebab-case`: Estándar para todos los directorios.

## Dónde Añadir Nuevo Código

**Nueva Característica (ej., "Inventario"):**

- Crear `src/features/inventario/`.
- Añadir subdirectorios para componentes, hooks, acciones.

**Nuevo Componente Compartido:**

- Implementation: `src/components/ui/[Name].tsx`.

**Nueva Utilidad Compartida:**

- Implementation: `src/lib/[name].ts`.

---

_Análisis de estructura: 2026-03-17_
_Actualizar cuando cambie la estructura de directorios_
