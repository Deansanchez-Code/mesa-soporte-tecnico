"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar as CalendarIcon,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getPendingAmbiente107Reservations,
  approveAmbiente107Reservation,
  cancelAmbiente107Reservation,
  suggestModification107Action,
} from "@/features/reservations/actions/ambiente107ApprovalActions";

interface PendingReservation {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  user_id: string;
  users: {
    full_name: string;
    email: string;
  };
  durationHours: number;
}

export default function Ambiente107ApprovalModal({
  userEmail,
}: {
  userEmail: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
  const [showEmptyToast, setShowEmptyToast] = useState(false);

  // Autorizada exclusiva: Norma Barrera o dasanchezh de respaldo
  const isCoordinator = [
    "nbarrerac@sena.edu.co",
    "dasanchezh@sena.edu.co",
  ].some((allowed) =>
    (userEmail || "").toLowerCase().includes(allowed.toLowerCase()),
  );

  useEffect(() => {
    if (!isCoordinator) return;

    const loadPending = async () => {
      setLoading(true);
      try {
        const data = await getPendingAmbiente107Reservations();
        if (data && data.length > 0) {
          setPending(data);
          setIsOpen(true);
        } else {
          setShowEmptyToast(true);
          setTimeout(() => setShowEmptyToast(false), 3000);
        }
      } catch (error) {
        console.error(
          "Error loading pending Ambiente 107 reservations:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadPending();
  }, [isCoordinator]);

  const handleAction = async (
    id: number,
    action: "approve" | "cancel" | "modify",
    extraData?: string,
  ) => {
    setIsActionLoading(id);
    try {
      let result;
      if (action === "approve") {
        result = await approveAmbiente107Reservation(id);
      } else if (action === "cancel") {
        result = await cancelAmbiente107Reservation(
          id,
          extraData || "Cancelado por coordinación",
        );
      } else {
        result = await suggestModification107Action(
          id,
          extraData || "Se sugiere ajuste de horario",
        );
      }

      if (result.success) {
        toast.success(
          action === "approve"
            ? "¡Reserva aprobada y confirmada!"
            : action === "cancel"
              ? "Reserva cancelada correctamente"
              : "Sugerencia enviada al usuario",
        );
        const updated = pending.filter((p) => p.id !== id);
        setPending(updated);
        if (updated.length === 0) {
          setIsOpen(false);
          setShowEmptyToast(true);
          setTimeout(() => setShowEmptyToast(false), 3000);
        }
      } else {
        toast.error(result.error || "Error al procesar la solicitud");
      }
    } catch {
      toast.error("Error de conexión al procesar");
    } finally {
      setIsActionLoading(null);
    }
  };

  if (!isCoordinator) return null;

  if (showEmptyToast) {
    return (
      <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
        <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400">
          <Clock className="w-5 h-5 animate-pulse" />
          <span className="font-semibold text-sm">
            Ambiente 107: Al día, no hay solicitudes pendientes de autorizar.
          </span>
        </div>
      </div>
    );
  }

  if (loading || !isOpen || pending.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        {/* Cabecera con identidad institucional y acento emerald para Ambiente 107 */}
        <div className="bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 p-8 sm:p-10 text-white relative flex-shrink-0">
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Gestión de Ambiente 107
                </span>
                <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold">
                  {pending.length} por autorizar
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Solicitudes de Prereserva
              </h2>
              <p className="text-emerald-100/90 text-sm mt-1 max-w-xl font-medium">
                Hola, Norma. Como coordinadora del Ambiente 107, puedes
                autorizar o sugerir ajustes a las solicitudes de formación.
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 backdrop-blur-sm self-end sm:self-auto"
            >
              Cerrar por ahora
            </button>
          </div>
        </div>

        {/* Lista de Reservas Pendientes */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-4 max-h-[calc(90vh-180px)] bg-slate-50/50">
          {pending.map((res) => {
            const start = new Date(res.start_time);
            const end = new Date(res.end_time);

            return (
              <div
                key={res.id}
                className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Ambiente 107
                    </span>
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Duración: {res.durationHours} horas
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {res.title}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 text-xs">
                          {res.users?.full_name || "Funcionario"}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {res.users?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 text-xs">
                          {format(start, "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {format(start, "hh:mm a")} - {format(end, "hh:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full lg:w-48 flex-shrink-0">
                  <button
                    disabled={isActionLoading === res.id}
                    onClick={() => handleAction(res.id, "approve")}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Autorizar Reserva
                  </button>

                  <button
                    disabled={isActionLoading === res.id}
                    onClick={() => {
                      const reason = prompt(
                        "Ingresa el motivo del rechazo para informar al solicitante:",
                      );
                      if (reason && reason.trim()) {
                        handleAction(res.id, "cancel", reason.trim());
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>

                  <button
                    disabled={isActionLoading === res.id}
                    onClick={() => {
                      const suggestion = prompt(
                        "Describe la sugerencia o ajuste de horario propuesto:",
                      );
                      if (suggestion && suggestion.trim()) {
                        handleAction(res.id, "modify", suggestion.trim());
                      }
                    }}
                    className="w-full py-2 px-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Sugerir Ajuste
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
