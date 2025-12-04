# Documentación Técnica del Proyecto

## Información General

- **Nombre del Proyecto**: Mesa de Ayuda TIC & Gestión de Activos
- **Descripción**: Sistema web para la gestión de soporte técnico, inventario de activos tecnológicos y reserva de auditorios.
- **Versión**: 1.0.0 (MVP)

## Stack Tecnológico

### Frontend

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Iconos**: [Lucide React](https://lucide.dev/)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Utilidades**:
  - `xlsx`: Procesamiento de archivos Excel.
  - `react-qr-code`: Generación de códigos QR.
  - `jspdf`: Generación de PDFs.

### Backend & Base de Datos

- **Plataforma**: [Supabase](https://supabase.com/)
- **Base de Datos**: PostgreSQL
- **Autenticación**: Supabase Auth (Email/Password)
- **Almacenamiento**: Supabase Storage (para evidencias y actas)

## Estructura del Proyecto

```
/
├── app/                    # Rutas y páginas de Next.js (App Router)
│   ├── admin/              # Panel de Control (Protegido)
│   ├── login/              # Página de inicio de sesión
│   ├── public-portal/      # Portal para usuarios finales
│   ├── layout.tsx          # Layout principal
│   └── page.tsx            # Página de inicio (Redirección)
├── components/             # Componentes reutilizables de React
│   ├── AuthGuard.tsx       # Protección de rutas
│   ├── AssetHistory...     # Componentes de gestión de activos
│   └── ...
├── lib/                    # Utilidades y configuración
│   ├── supabase.ts         # Cliente de Supabase
│   ├── storage.ts          # Helpers para localStorage seguro
│   └── utils.ts            # Funciones de utilidad generales
├── public/                 # Archivos estáticos
└── ...
```

## Configuración e Instalación

### Prerrequisitos

- Node.js 18+
- Cuenta en Supabase

### Variables de Entorno

Crear un archivo `.env.local` en la raíz del proyecto con las siguientes credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### Ejecución Local

1.  **Instalar dependencias**:

    ```bash
    npm install
    ```

2.  **Iniciar servidor de desarrollo**:

    ```bash
    npm run dev
    ```

    La aplicación estará disponible en `http://localhost:3000`.

3.  **Construir para producción**:
    ```bash
    npm run build
    npm start
    ```

## Despliegue

El proyecto está optimizado para ser desplegado en **Vercel**, conectando directamente el repositorio de GitHub.
