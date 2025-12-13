"use client";

import { useEffect } from "react";
import { useSessionMonitor } from "@/hooks/useSessionMonitor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, Coffee, ShieldAlert } from "lucide-react";

export default function SessionMonitor() {
  const {
    session,
    startSession,
    showLunchModal,
    setShowLunchModal,
    showOvertimeModal,
    setShowOvertimeModal,
  } = useSessionMonitor();

  // Auto-start al montar si no hay sesión activa (y es usuario válido)
  useEffect(() => {
    if (!session.isActive && session.publicIp) {
      // Intentar iniciar sesión automáticamente al cargar la app
      // Esto registrará la entrada.
      startSession();
    }
  }, [session.isActive, session.publicIp, startSession]);

  return (
    <>
      {/* 1. Modal Pausa Almuerzo */}
      <AlertDialog open={showLunchModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <Coffee className="w-5 h-5" /> Hora de Almuerzo (12:00)
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ha llegado la hora de pausa programada. ¿Desea pausar su contador
              de turno o continuar trabajando?
              <br />
              <br />
              Si no responde en unos minutos, el sistema cerrará su sesión por
              seguridad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                // Lógica de Continuar (Skip Break)
                setShowLunchModal(false);
              }}
              className="bg-sena-blue hover:bg-blue-800"
            >
              Continuar Trabajando
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                // Lógica Pausar (Logout o Stop Timer)
                // Por ahora cerramos el modal, idealmente llamaría a logout
                setShowLunchModal(false);
                // window.location.href = "/api/auth/logout"; // Ejemplo
              }}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Pausar (Salir)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2. Modal Fin de Turno (Extras) */}
      <AlertDialog open={showOvertimeModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Clock className="w-5 h-5" /> Fin de Turno Detectado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Su horario programado ha finalizado. ¿Está autorizado para
              continuar con <strong>Horas Extras</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowOvertimeModal(false)}>
              Sí, Continuar (Extras)
            </AlertDialogAction>
            {/* Opción de salida */}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Indicador Flotante (Opcional - solo para pruebas/feedback visual) */}
      {!session.isSenaNetwork && session.isActive && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-1 rounded-full text-xs shadow-lg z-50 flex items-center gap-2">
          <ShieldAlert className="w-3 h-3" /> Red Externa
        </div>
      )}
    </>
  );
}
