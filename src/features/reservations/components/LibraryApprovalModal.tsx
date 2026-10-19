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
  X,
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

  // Sub-modal para Rechazo o Sugerencia (elimina window.prompt nativo)
  const [actionModal, setActionModal] = useState<{
    type: "cancel" | "modify";
    reservation: PendingReservation;
  } | null>(null);
  const [actionText, setActionText] = useState("");

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

  const handleConfirmActionModal = async () => {
    if (!actionModal) return;
    const trimmed = actionText.trim();
    if (!trimmed) {
      toast.error(
        actionModal.type === "cancel"
          ? "Por favor ingresa el motivo del rechazo."
          : "Por favor describe la propuesta de modificación.",
      );
      return;
    }

    const { type, reservation } = actionModal;
    setIsActionLoading(reservation.id);
    try {
      if (type === "cancel") {
        const result = await cancelLibraryReservation(reservation.id, trimmed);
        if (result.success) {
          toast.success("Reserva cancelada. Se informó al solicitante.");
          setPending((prev) => prev.filter((p) => p.id !== reservation.id));
          if (pending.length <= 1) {
            setIsOpen(false);
            setShowEmptyToast(true);
            setTimeout(() => setShowEmptyToast(false), 3000);
          }
        } else {
          toast.error(result.error || "Error al cancelar");
        }
      } else {
        const result = await requestModificationAction(reservation.id, trimmed);
        if (result.success) {
          toast.info("Sugerencia enviada al solicitante.");
          setPending((prev) => prev.filter((p) => p.id !== reservation.id));
          if (pending.length <= 1) {
            setIsOpen(false);
            setShowEmptyToast(true);
            setTimeout(() => setShowEmptyToast(false), 3000);
          }
        } else {
          toast.error(result.error || "Error al procesar");
        }
      }
    } catch {
      toast.error("Error de conexión al procesar");
    } finally {
      setIsActionLoading(null);
      setActionModal(null);
      setActionText("");
    }
  };

  const handleCloseActionModal = () => {
    setActionModal(null);
    setActionText("");
  };

  if (!isCoordinator) return null;

  if (showEmptyToast) {
    return (
      <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
        <div
          className="text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-blue-400"
          style={{ backgroundColor: "#043263" }}
        >
          <Clock className="w-5 h-5 animate-pulse text-blue-200" />
          <span className="font-semibold text-sm">
            Biblioteca al día: No hay reservas pendientes por autorizar.
          </span>
        </div>
      </div>
    );
  }

  if (loading) return null;

  if (!isOpen || pending.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
          {/* Header con gradiente premium de alto contraste */}
          <div
            className="p-8 sm:p-10 text-white relative flex-shrink-0 bg-[#043263]"
            style={{
              backgroundColor: "#043263",
              backgroundImage:
                "linear-gradient(135deg, #043263 0%, #1e3a8a 50%, #0f172a 100%)",
            }}
          >
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border border-white/20"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                  >
                    Panel de Control
                  </span>
                  <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">
                    Prioridad
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm">
                  Autorizaciones{" "}
                  <span className="text-blue-200">Pendientes</span>
                </h2>
                <p className="text-blue-100 mt-2 text-sm sm:text-base font-medium max-w-lg leading-relaxed">
                  Se han detectado {pending.length}{" "}
                  {pending.length === 1 ? "solicitud" : "solicitudes"} de
                  reserva para el área de Biblioteca que requieren su revisión
                  inmediata.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="bg-white/15 hover:bg-white/25 p-3 rounded-full transition-colors self-end sm:self-center text-white border border-white/20 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Elementos decorativos */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none"></div>
          </div>

          {/* Lista de Reservas con Scroll Suave */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {pending.map((res, idx) => (
              <div
                key={res.id}
                className="group bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row gap-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300 ring-1 ring-transparent hover:ring-blue-50"
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
                          <span className="text-blue-600 font-semibold">
                            {res.users.email}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-2xl font-black text-slate-200 group-hover:text-slate-300 transition-colors select-none">
                        #{idx + 1}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 border border-slate-200/80">
                      <CalendarIcon className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Fecha de Evento
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {format(
                            new Date(res.start_time),
                            "EEEE d 'de' MMMM",
                            {
                              locale: es,
                            },
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 border border-slate-200/80">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Horario
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {format(new Date(res.start_time), "hh:mm a")} -{" "}
                          {format(new Date(res.end_time), "hh:mm a")}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 border border-slate-200/80 sm:col-span-2 lg:col-span-1">
                      <Timer className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Duración
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {res.durationHours}{" "}
                          {res.durationHours === 1 ? "Hora" : "Horas"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {res.title && (
                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-900">
                        {res.title}
                      </p>
                    </div>
                  )}
                </div>

                {/* Botones de acción laterales */}
                <div className="flex md:flex-col justify-end gap-3 pt-4 md:pt-0 md:pl-6 md:border-l md:border-slate-100 min-w-[180px]">
                  <button
                    disabled={isActionLoading !== null}
                    onClick={() => handleApprove(res.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Autorizar
                  </button>
                  <div className="flex gap-2 flex-1 md:flex-none">
                    <button
                      disabled={isActionLoading !== null}
                      onClick={() => {
                        setActionText("");
                        setActionModal({ type: "modify", reservation: res });
                      }}
                      className="flex-1 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                      title="Pedir Modificaciones"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                    <button
                      disabled={isActionLoading !== null}
                      onClick={() => {
                        setActionText("");
                        setActionModal({ type: "cancel", reservation: res });
                      }}
                      className="flex-1 flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                      title="Rechazar"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Las reservas aprobadas aparecerán inmediatamente en el calendario
              global.
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-600 hover:text-slate-900 font-bold text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              Revisar más tarde <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Submodal interactivo para Rechazar o Sugerir Ajuste en Biblioteca */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header del Submodal */}
            <div
              className="p-6 text-white"
              style={{
                backgroundColor:
                  actionModal.type === "cancel" ? "#be123c" : "#043263",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    {actionModal.type === "cancel" ? (
                      <XCircle className="w-6 h-6" />
                    ) : (
                      <MessageSquare className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-white">
                      {actionModal.type === "cancel"
                        ? "Rechazar Solicitud de Reserva"
                        : "Sugerir Ajuste de Horario"}
                    </h3>
                    <p className="text-xs text-white/90 font-medium">
                      Biblioteca • Coordinación
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseActionModal}
                  className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido del Submodal */}
            <div className="p-6 space-y-4">
              {/* Resumen de la reserva */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm">
                  {actionModal.reservation.title}
                </p>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <User className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                  <span>
                    {actionModal.reservation.users?.full_name || "Solicitante"}{" "}
                    ({actionModal.reservation.users?.email})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                  <span>
                    {format(
                      new Date(actionModal.reservation.start_time),
                      "EEEE d 'de' MMMM, hh:mm a",
                      { locale: es },
                    )}
                  </span>
                </div>
              </div>

              {/* Formulario */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  {actionModal.type === "cancel"
                    ? "Motivo del rechazo (se informará al solicitante) *"
                    : "Propuesta de nuevo horario o recomendación *"}
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder={
                    actionModal.type === "cancel"
                      ? "Ej: La sala de biblioteca estará ocupada por capacitación interna..."
                      : "Ej: Se sugiere ajustar el horario a la jornada de la tarde..."
                  }
                  className="w-full text-sm p-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 placeholder:text-slate-400 font-normal"
                />
                <p className="text-[11px] text-slate-600 mt-1.5 font-medium">
                  {actionModal.type === "cancel"
                    ? "Este motivo se enviará al usuario solicitante."
                    : "La sugerencia será notificada al usuario solicitante."}
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseActionModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isActionLoading === actionModal.reservation.id}
                  onClick={handleConfirmActionModal}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                    actionModal.type === "cancel"
                      ? "bg-rose-700 hover:bg-rose-800"
                      : "bg-blue-700 hover:bg-blue-800"
                  }`}
                >
                  {isActionLoading === actionModal.reservation.id ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : actionModal.type === "cancel" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {actionModal.type === "cancel"
                    ? "Confirmar Rechazo"
                    : "Enviar Sugerencia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
