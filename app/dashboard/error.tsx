"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-orange-50 p-4 rounded-full mb-4">
        <AlertTriangle className="w-12 h-12 text-orange-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        {" "}
        Error en el Panel{" "}
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        Hubo un problema cargando esta sección del dashboard.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-sena-green text-white rounded-lg font-bold hover:bg-green-700 transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Reintentar
        </button>
      </div>
    </div>
  );
}
