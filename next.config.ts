import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public", // Dónde se guardan los archivos del service worker
  register: true, // Registrar el worker automáticamente
  skipWaiting: true, // Actualizar la app apenas haya nueva versión
  disable: process.env.NODE_ENV === "development", // Desactivar en modo desarrollo para que no moleste
});

const nextConfig: NextConfig = {
  turbopack: {}, // Configuración vacía de Turbopack para Next.js 16
  /* Aquí puedes poner otras configuraciones si las necesitas en el futuro */
};

export default withPWA(nextConfig);
