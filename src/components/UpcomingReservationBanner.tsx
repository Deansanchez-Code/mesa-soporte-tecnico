"use client";

import { useState } from "react";
import { Clock, CheckCircle, Calendar, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { UpcomingAlertData } from "@/hooks/useUpcomingReservationAlert";
import {
  confirmReservationAction,
  cancelReservationAction,
} from "@/features/reservations/actions/reservationActions";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";

interface UpcomingReservationBannerProps {
  alertData: UpcomingAlertData;
  userProfile: UserProfile["profile"];
  onDismiss: (id: number) => void;
}

export default function UpcomingReservationBanner({
  alertData,
  userProfile,
  onDismiss,
}: UpcomingReservationBannerProps) {
  const { reservation, minutesRemaining, spaceName } = alertData;
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);

  const handleConfirm = async () => {
    setLoadingAction("confirm");
    try {
      const res = await confirmReservationAction(reservation.id);
      if (res.success) {
        toast.success("¡Asistencia Confirmada!", {
          description: `Tu reserva de "${reservation.title}" ha sido confirmada.`,
        });
        onDismiss(reservation.id);
      } else {
        toast.error("Error al confirmar", { description: res.error });
      }
    } catch {
      toast.error("Error al procesar la confirmación.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRelease = async () => {
    if (
      !confirm(
        `¿Seguro que deseas LIBERAR el espacio ${spaceName}?\n\nLa reserva "${reservation.title}" será cancelada inmediatamente y el horario quedará disponible en el calendario.`,
      )
    ) {
      return;
    }

    setLoadingAction("release");
    try {
      const res = await cancelReservationAction(reservation.id);
      if (res.success) {
        toast.info("Espacio Liberado", {
          description: `La reserva se ha cancelado y el espacio ${spaceName} está disponible.`,
        });
        onDismiss(reservation.id);
      } else {
        toast.error("Error al liberar espacio", { description: res.error });
      }
    } catch {
      toast.error("Error al procesar la cancelación.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[90] max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-sena-orange/30 overflow-hidden">
          {/* Header del Aviso */}
          <div className="bg-gradient-to-r from-amber-500 to-sena-orange p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 animate-pulse" />
              <span className="font-bold text-sm tracking-wide">
                ¡Tu evento inicia en {minutesRemaining} min!
              </span>
            </div>
            <button
              onClick={() => onDismiss(reservation.id)}
              className="p-1 hover:bg-white/20 rounded-full transition"
              title="Ignorar aviso por ahora"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Cuerpo con Información y Botones de Acción */}
          <div className="p-5 space-y-4 bg-amber-50/20">
            <div>
              <span className="text-[10px] uppercase font-bold text-sena-orange tracking-wider block">
                {spaceName}
              </span>
              <h4 className="text-base font-black text-slate-800 leading-tight mt-0.5">
                {reservation.title}
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Por favor confirma tu asistencia o libera el espacio en el
              calendario si tus planes cambiaron.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleConfirm}
                disabled={loadingAction !== null}
                className="py-2.5 px-2 bg-sena-green hover:bg-[#2d8500] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Confirmar
              </button>

              <button
                onClick={() => setIsRescheduleOpen(true)}
                disabled={loadingAction !== null}
                className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                Reagendar
              </button>

              <button
                onClick={handleRelease}
                disabled={loadingAction !== null}
                className="py-2.5 px-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Liberar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Reagendar */}
      {isRescheduleOpen && userProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <AuditoriumReservationForm
              user={userProfile}
              reservationToEdit={reservation}
              initialSpace={reservation.auditorium_id || "1"}
              onCancel={() => setIsRescheduleOpen(false)}
              onSuccess={() => {
                setIsRescheduleOpen(false);
                toast.success("Reserva Reagendada Exitosamente");
                onDismiss(reservation.id);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
