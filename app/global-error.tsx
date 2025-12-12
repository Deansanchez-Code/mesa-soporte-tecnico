"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-gray-50 flex items-center justify-center min-h-screen font-sans text-gray-800">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>

          <h2 className="text-2xl font-bold mb-2">¡Ups! Algo salió mal</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Hemos detectado un error inesperado. No te preocupes, tu sesión está
            segura.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left border border-gray-200">
            <p className="text-xs font-mono text-gray-500 break-all">
              Code: {error.message || "Unknown Error"}
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-gray-400 mt-1">
                ID: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full bg-sena-blue hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Intentar Recargar
            </button>

            <Link
              href="/"
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg border border-gray-300 transition flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Ir al Inicio
            </Link>
          </div>

          <p className="text-xs text-gray-300 mt-8">
            Si el problema persiste, contacta al administrador.
          </p>
        </div>
      </body>
    </html>
  );
}
