import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soporte TIC SENA",
  description: "Sistema de gestión de tickets en sitio",
  manifest: "/manifest.json",
};

// En Next.js moderno, la configuración visual del dispositivo va en 'viewport'
export const viewport: Viewport = {
  themeColor: "#39A900",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased flex flex-col min-h-screen">
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="py-6 text-center text-xs text-gray-400 font-medium">
          <p>
            Desarrollado por{" "}
            <span className="font-bold text-gray-500">DashDev.co</span> - Todos
            los derechos reservados
          </p>
        </footer>
      </body>
    </html>
  );
}
