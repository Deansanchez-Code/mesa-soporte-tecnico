"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar as CalendarIcon,
  Timer,
  MessageSquare,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getPendingLibraryReservations,
  approveLibraryReservation,
  cancelLibraryReservation,
  requestModificationAction,
} from "@/features/reservations/actions/libraryApprovalActions";

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

export default function LibraryApprovalModal({
  userEmail,
}: {
  userEmail: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
  const [showEmptyToast, setShowEmptyToast] = useState(false);

  const isCoordinator = [
    "dasanchezh@sena.edu.co",
    "egutierrezn@sena.edu.co",
    "egutierrezn@sistema.local",
    "emgutierrezn@sena.edu.co",
    "emgutierrezn@sistema.local",
  ].includes((userEmail || "").toLowerCase());

  useEffect(() => {
    if (!isCoordinator) return;

    const loadPending = async () => {
      setLoading(true);
      try {
        const data = await getPendingLibraryReservations();
        if (data && data.length > 0) {
          setPending(data);
          setIsOpen(true);
        } else {
          // Show info message for 3 seconds as requested
          setShowEmptyToast(true);
          setTimeout(() => setShowEmptyToast(false), 3000);
        }
      } catch (error) {
        console.error("Error loading pending reservations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPending();
  }, [isCoordinator, userEmail]);

  const handleApprove = async (id: number) => {
    setIsActionLoading(id);
    try {
      const result = await approveLibraryReservation(id);
      if (result.success) {
        toast.success("Reserva autorizada correctamente.");
        setPending((prev) => prev.filter((p) => p.id !== id));
        if (pending.length <= 1) {
          setIsOpen(false);
          setShowEmptyToast(true);
          setTimeout(() => setShowEmptyToast(false), 3000);
        }
      } else {
        toast.error(result.error || "Error al autorizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleCancel = async (id: number) => {
    const reason = window.prompt("Motivo de la cancelación:");
    if (reason === null) return;

    setIsActionLoading(id);
    try {
      const result = await cancelLibraryReservation(id, reason);
      if (result.success) {
        toast.success("Reserva cancelada.");
        setPending((prev) => prev.filter((p) => p.id !== id));
        if (pending.length <= 1) {
          setIsOpen(false);
          setShowEmptyToast(true);
          setTimeout(() => setShowEmptyToast(false), 3000);
        }
      } else {
        toast.error(result.error || "Error al cancelar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleModify = async (id: number) => {
    const suggestion = window.prompt("Sugerencia de modificación:");
    if (suggestion === null) return;

    setIsActionLoading(id);
    try {
      const result = await requestModificationAction(id, suggestion);
      if (result.success) {
        toast.info("Sugerencia enviada al solicitante.");
        setPending((prev) => prev.filter((p) => p.id !== id));
        if (pending.length <= 1) {
          setIsOpen(false);
          setShowEmptyToast(true);
          setTimeout(() => setShowEmptyToast(false), 3000);
        }
      } else {
        toast.error(result.error || "Error al procesar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsActionLoading(null);
    }
  };

  if (!isCoordinator) return null;

  if (showEmptyToast) {
    return (
      <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
        <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-blue-400">
          <Clock className="w-5 h-5 animate-pulse" />
          <span className="font-medium text-sm">
            De momento no hay reservas de biblioteca por autorizar.
          </span>
        </div>
      </div>
    );
  }

  if (loading) return null; // Or a subtle loader if preferred

  if (!isOpen || pending.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        {/* Header con gradiente premium */}
        <div className="bg-gradient-to-br from-sena-blue to-blue-800 p-8 sm:p-10 text-white relative flex-shrink-0">
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10">
                  Panel de Control
                </span>
                <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                  Prioridad
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Autorizaciones <span className="text-blue-200">Pendientes</span>
              </h2>
              <p className="text-blue-100/80 mt-2 text-sm sm:text-base font-medium max-w-lg">
                Se han detectado {pending.length}{" "}
                {pending.length === 1 ? "solicitud" : "solicitudes"} de reserva
                para el área de Biblioteca que requieren su revisión inmediata.
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors self-end sm:self-center"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Elementos decorativos */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        </div>

        {/* Lista de Reservas con Scroll Suave */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {pending.map((res, idx) => (
            <div
              key={res.id}
              className="group bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row gap-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300 ring-1 ring-transparent hover:ring-blue-50"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-900 transition-colors">
                        {res.users.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        Solicitante •{" "}
                        <span className="text-blue-600">{res.users.email}</span>
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-2xl font-black text-slate-100 group-hover:text-slate-200 transition-colors absolute right-8 top-4 select-none">
                      #{idx + 1}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                  <div className="bg-slate-100/50 rounded-2xl p-4 flex items-center gap-3 border border-slate-100">
                    <CalendarIcon className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Fecha de Evento
                      </p>
                      <p className="text-sm font-bold text-slate-700">
                        {format(new Date(res.start_time), "EEEE d 'de' MMMM", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-100/50 rounded-2xl p-4 flex items-center gap-3 border border-slate-100">
                    <Timer className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Horario
                      </p>
                      <p className="text-sm font-bold text-slate-700">
                        {format(new Date(res.start_time), "HH:mm")} -{" "}
                        {format(new Date(res.end_time), "HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-100/50 rounded-2xl p-4 flex items-center gap-3 border border-slate-100">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Duración Total
                      </p>
                      <p className="text-sm font-bold text-slate-700">
                        {res.durationHours}{" "}
                        {res.durationHours === 1 ? "Hora" : "Horas"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/30 rounded-2xl p-4 border border-blue-50 flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                      Actividad
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {res.title}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de acción laterales */}
              <div className="flex md:flex-col justify-end gap-3 pt-4 md:pt-0 md:pl-6 md:border-l md:border-slate-100 min-w-[180px]">
                <button
                  disabled={isActionLoading !== null}
                  onClick={() => handleApprove(res.id)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-sena-green hover:bg-green-700 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-lg shadow-green-900/10 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Autorizar
                </button>
                <div className="flex gap-2 flex-1 md:flex-none">
                  <button
                    disabled={isActionLoading !== null}
                    onClick={() => handleModify(res.id)}
                    className="flex-1 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-amber-900/10 active:scale-95 disabled:opacity-50 disabled:scale-100"
                    title="Pedir Modificaciones"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  <button
                    disabled={isActionLoading !== null}
                    onClick={() => handleCancel(res.id)}
                    className="flex-1 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-red-900/10 active:scale-95 disabled:opacity-50 disabled:scale-100"
                    title="Cancelar"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Las reservas aprobadas aparecerán inmediatamente en el calendario
            global.
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-slate-800 font-bold text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
          >
            Revisar más tarde <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
