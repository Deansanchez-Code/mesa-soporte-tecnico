"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Detección específica para errores de carga de Chunks (versiones desactualizadas)
    if (
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("Failed to load chunk") ||
      error.name === "ChunkLoadError"
    ) {
      // Opcional: Forzar recarga si es la primera vez que ocurre en la sesión
      const isRecovering = sessionStorage.getItem("chunk_reload_recovery");
      if (!isRecovering) {
        sessionStorage.setItem("chunk_reload_recovery", "true");
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-red-50 rounded-2xl border border-red-100 m-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Algo salió mal
            </h2>
            <p className="text-gray-600 mb-6 max-w-md">
              Hemos detectado un error inesperado (posiblemente una
              actualización pendiente). Por favor recarga la página.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem("chunk_reload_recovery");
                window.location.reload();
              }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Recargar aplicación
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
