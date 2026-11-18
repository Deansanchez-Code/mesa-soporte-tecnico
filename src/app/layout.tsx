import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";
import SessionMonitor from "@/features/shifts/components/SessionMonitor";
import QueryProvider from "@/components/providers/QueryProvider";
import { headers } from "next/headers";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Soporte TIC SENA · Swiss GovTech",
  description: "Sistema de gestión de tickets y ambientes en sitio",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

// En Next.js moderno, la configuración visual del dispositivo va en 'viewport'
export const viewport: Viewport = {
  themeColor: "#39A900",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || "";

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${jakartaSans.variable} ${jetbrainsMono.variable} overflow-x-hidden`}
      nonce={nonce}
    >
      <body className="bg-[var(--surface-canvas)] text-[var(--text-primary)] antialiased flex flex-col min-h-dvh overflow-x-hidden">
        <main className="flex-1 flex flex-col">
          <NotificationProvider>
            <QueryProvider>
              {children}
              <SessionMonitor />
              <Toaster richColors position="top-right" />
            </QueryProvider>
          </NotificationProvider>
        </main>
        <footer className="py-4 px-6 border-t border-[var(--border-hairline)] bg-white/80 text-center text-xs text-slate-500 font-medium flex flex-wrap items-center justify-center gap-3">
          <span className="tabular-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#043263] text-white">
            GOV·SENA·2026
          </span>
          <p>
            Desarrollado por{" "}
            <span className="font-bold text-slate-700">DashDev.co</span> — Todos
            los derechos reservados
          </p>
        </footer>
      </body>
    </html>
  );
}
