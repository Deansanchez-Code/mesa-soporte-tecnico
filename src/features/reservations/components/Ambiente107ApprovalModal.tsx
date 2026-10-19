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
  X,
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

import { supabase } from "@/lib/supabase/client";

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
  const [detectedEmail, setDetectedEmail] = useState<string>(userEmail || "");

  // Sub-modal para Rechazo o Sugerencia (elimina window.prompt nativo)
  const [actionModal, setActionModal] = useState<{
    type: "cancel" | "modify";
    reservation: PendingReservation;
  } | null>(null);
  const [actionText, setActionText] = useState("");

  useEffect(() => {
    if (userEmail) {
      setDetectedEmail(userEmail);
      return;
    }
    // Fallback: detectar usuario autenticado client-side si la prop llegó vacía
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setDetectedEmail(data.user.email);
      }
    });
  }, [userEmail]);

  // Autorizada exclusiva: Nury Mildret Barrera (nbarrerac@sena.edu.co o username nbarrerac)
  const isCoordinator = [
    "nbarrerac@sena.edu.co",
    "nbarrerac",
    "dasanchezh@sena.edu.co",
    "dasanchezh",
  ].some((allowed) =>
    (detectedEmail || "").toLowerCase().includes(allowed.toLowerCase()),
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
            ? "¡Reserva autorizada con éxito! Se notificó al solicitante por correo institucional."
            : action === "cancel"
              ? "Reserva rechazada. Se informó la justificación al solicitante."
              : "Sugerencia de ajuste enviada con éxito al solicitante.",
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

  const handleConfirmActionModal = async () => {
    if (!actionModal) return;
    const trimmed = actionText.trim();
    if (!trimmed) {
      toast.error(
        actionModal.type === "cancel"
          ? "Por favor ingresa el motivo del rechazo para informar al solicitante."
          : "Por favor describe la propuesta de ajuste de horario.",
      );
      return;
    }
    const { type, reservation } = actionModal;
    await handleAction(reservation.id, type, trimmed);
    setActionModal(null);
    setActionText("");
  };

  const handleCloseActionModal = () => {
    setActionModal(null);
    setActionText("");
  };

  if (!isCoordinator) return null;
  if (loading) return null;

  // Botón flotante accesible siempre que sea coordinadora y el modal esté cerrado
  if (!isOpen || pending.length === 0) {
    if (showEmptyToast) {
      return (
        <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
          <div
            className="text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400"
            style={{ backgroundColor: "#065f46" }}
          >
            <Clock className="w-5 h-5 text-emerald-200 animate-pulse" />
            <span className="font-semibold text-sm">
              Ambiente 107 al día: No hay solicitudes pendientes de autorizar.
            </span>
          </div>
        </div>
      );
    }

    if (pending.length > 0) {
      return (
        <div className="fixed bottom-8 right-8 z-[90] animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-400 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{ backgroundColor: "#065f46" }}
          >
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>Ambiente 107 ({pending.length} pendientes)</span>
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
          {/* Cabecera con identidad institucional y fondo sólido garantizado de alto contraste */}
          <div
            className="p-8 sm:p-10 text-white relative flex-shrink-0 bg-[#064e3b]"
            style={{
              backgroundColor: "#064e3b",
              backgroundImage:
                "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #0f172a 100%)",
            }}
          >
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span
                    className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-200 border border-emerald-400/40"
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.25)" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    Gestión de Ambiente 107
                  </span>
                  <span
                    className="text-white text-xs px-3 py-1 rounded-full font-bold border border-white/25"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                  >
                    {pending.length} por autorizar
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                  Solicitudes de Prereserva
                </h2>
                <p className="text-emerald-100 text-sm mt-1.5 max-w-xl font-medium leading-relaxed">
                  Hola,{" "}
                  <strong className="text-white font-bold">Nury Mildret</strong>
                  . Como coordinadora del Ambiente 107, puedes autorizar o
                  sugerir ajustes a las solicitudes de formación.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/25 backdrop-blur-sm self-end sm:self-auto cursor-pointer shadow-sm"
              >
                Cerrar por ahora
              </button>
            </div>
          </div>

          {/* Lista de Reservas Pendientes */}
          <div className="p-6 sm:p-8 overflow-y-auto space-y-4 max-h-[calc(90vh-180px)] bg-slate-50/70">
            {pending.map((res) => {
              const start = new Date(res.start_time);
              const end = new Date(res.end_time);

              return (
                <div
                  key={res.id}
                  className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        Ambiente 107
                      </span>
                      <span className="text-slate-600 font-medium text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Duración: {res.durationHours} horas
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {res.title}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-900 text-xs">
                            {res.users?.full_name || "Funcionario"}
                          </p>
                          <p className="text-[11px] text-slate-600 truncate font-medium">
                            {res.users?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">
                            {format(start, "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                          <p className="text-[11px] text-slate-600 font-medium">
                            {format(start, "hh:mm a")} -{" "}
                            {format(end, "hh:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Alto Contraste y Accesibilidad */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-48 flex-shrink-0">
                    <button
                      disabled={isActionLoading === res.id}
                      onClick={() => handleAction(res.id, "approve")}
                      className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Autorizar Reserva
                    </button>

                    <button
                      disabled={isActionLoading === res.id}
                      onClick={() => {
                        setActionText("");
                        setActionModal({ type: "cancel", reservation: res });
                      }}
                      className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Rechazar
                    </button>

                    <button
                      disabled={isActionLoading === res.id}
                      onClick={() => {
                        setActionText("");
                        setActionModal({ type: "modify", reservation: res });
                      }}
                      className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <MessageSquare className="w-4 h-4 text-slate-500" />
                      Sugerir Ajuste
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Submodal interactivo para Rechazar o Sugerir Ajuste (Sustituye window.prompt) */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header del Submodal */}
            <div
              className="p-6 text-white"
              style={{
                backgroundColor:
                  actionModal.type === "cancel" ? "#be123c" : "#065f46",
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
                      Ambiente 107 • Gestión de Formación
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
                  <User className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                  <span>
                    {actionModal.reservation.users?.full_name || "Solicitante"}{" "}
                    ({actionModal.reservation.users?.email})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CalendarIcon className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
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
                      ? "Ej: El ambiente estará ocupado con mantenimiento de equipos en esa fecha..."
                      : "Ej: Sugiero adelantar la sesión de 08:00 AM a 10:00 AM para mayor disponibilidad..."
                  }
                  className="w-full text-sm p-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-slate-900 placeholder:text-slate-400 font-normal"
                />
                <p className="text-[11px] text-slate-600 mt-1.5 font-medium">
                  {actionModal.type === "cancel"
                    ? "Este mensaje será enviado directamente al correo institucional del solicitante."
                    : "El instructor recibirá esta sugerencia y podrá responder o reprogramar su solicitud."}
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
                      : "bg-emerald-700 hover:bg-emerald-800"
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
