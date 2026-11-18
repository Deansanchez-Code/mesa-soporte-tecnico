import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "sonner";
import SessionMonitor from "@/features/shifts/components/SessionMonitor";
import QueryProvider from "@/components/providers/QueryProvider";
import InstitutionalFooter from "@/components/InstitutionalFooter";
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
  title: "Gestión de Ambientes y Reservas · SENA",
  description:
    "Plataforma institucional para la gestión de ambientes especiales, auditorio, biblioteca y programación de reservas SENA.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg?v=20261118", type: "image/svg+xml" },
      { url: "/icon.png?v=20261118", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=20261118", sizes: "any" },
    ],
    shortcut: ["/icon.svg?v=20261118"],
    apple: [{ url: "/apple-icon.png?v=20261118", sizes: "180x180" }],
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
        <InstitutionalFooter />
      </body>
    </html>
  );
}
