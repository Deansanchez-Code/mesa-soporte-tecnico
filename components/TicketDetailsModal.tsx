"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  X,
  User,
  MapPin,
  Calendar,
  Monitor,
  Clock,
  PlayCircle,
  PauseCircle,
  MessageSquare,
} from "lucide-react";
import { Ticket } from "@/app/admin/types";

interface TicketEvent {
  id: number;
  created_at: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  comment?: string;
  actor_id?: string;
  actor_name?: string;
}

interface PauseReason {
  id: number;
  reason_code: string;
  description: string;
}

interface TicketDetailsModalProps {
  ticket: Ticket;
  agents?: { id: string; full_name: string; role: string }[];
  onAssign?: (ticketId: number, agentId: string) => Promise<void>;
  onAddComment?: (ticketId: number, comment: string) => Promise<void>;
  onUpdateStatus?: (ticketId: number, status: string) => Promise<void>;
  currentUser?: { id: string; full_name: string };
  onClose: () => void;
}

export default function TicketDetailsModal({
  ticket,
  onClose,
  agents = [],
  onAssign,
  onAddComment,
  onUpdateStatus,
  currentUser,
}: TicketDetailsModalProps) {
  // State
  const [selectedAgentId, setSelectedAgentId] = React.useState(
    ticket.assigned_agent_id || ""
  );
  const [assigning, setAssigning] = React.useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Pause/Resume State
  const [pauseReasons, setPauseReasons] = useState<PauseReason[]>([]);
  const [showPauseInput, setShowPauseInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  // Initial Fetch
  useEffect(() => {
    const fetchDetails = async () => {
      setLoadingEvents(true);

      // 1. Fetch Events
      const { data: eventsData, error: eventsError } = await supabase
        .from("ticket_events")
        .select(
          `
                id, created_at, action_type, old_value, new_value, comment,
                actor:actor_id ( full_name )
            `
        )
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });

      if (!eventsError && eventsData) {
        // Flatten actor name
        const formatted = eventsData.map((e) => ({
          ...e,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actor_name: (e as any).actor?.full_name || "Sistema",
        }));
        setEvents(formatted);
      }

      // 2. Fetch Pause Reasons (Only if needed)
      const { data: reasonsData } = await supabase
        .from("pause_reasons")
        .select("*")
        .eq("is_active", true);

      if (reasonsData) {
        setPauseReasons(reasonsData);
      }

      setLoadingEvents(false);
    };

    fetchDetails();
  }, [ticket.id]);

  // Handle Pause
  const handlePause = async () => {
    if (!selectedReason) return;
    setProcessingAction(true);

    const finalReason =
      selectedReason === "OTHER" ? customReason : selectedReason;
    if (!finalReason) {
      setProcessingAction(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          sla_status: "paused",
          sla_pause_reason: finalReason,
          // Lógica inteligente: Si el motivo menciona repuestos/garantía -> Freezer
          // Si es otra cosa (ej: 'esperando usuario') -> Se mantiene en EN_PROGRESO pero pausado
          status: /repuesto|garant|proveedor|compra/i.test(finalReason)
            ? "EN_ESPERA"
            : "EN_PROGRESO",
        })
        .eq("id", ticket.id);

      if (error) throw error;

      // TRAZABILIDAD: Registrar evento
      if (currentUser?.id) {
        await supabase.from("ticket_events").insert({
          ticket_id: ticket.id,
          actor_id: currentUser.id,
          action_type: "PAUSED",
          comment: `Pausado por: ${finalReason}. (Estado: ${
            /repuesto|garant|proveedor|compra/i.test(finalReason)
              ? "En Espera"
              : "Operativo"
          })`,
        });
      }

      onClose(); // Triggers refresh in parent
    } catch (e) {
      console.error("Error pausing ticket:", e);
      alert("Error al pausar el ticket.");
    }
  };

  // Handle Resume
  const handleResume = async () => {
    setProcessingAction(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          sla_status: "running",
          status: "EN_PROGRESO", // Auto-move to In Progress
        })
        .eq("id", ticket.id);

      if (error) throw error;

      // TRAZABILIDAD: Registrar evento
      if (currentUser?.id) {
        await supabase.from("ticket_events").insert({
          ticket_id: ticket.id,
          actor_id: currentUser.id,
          action_type: "RESUMED",
          comment: "SLA Reanudado manualmente.",
        });
      }

      onClose();
    } catch (e) {
      console.error("Error resuming ticket:", e);
      alert("Error al reanudar el ticket.");
    }
  };

  const handleAssign = async () => {
    if (!onAssign || !selectedAgentId) return;
    setAssigning(true);
    try {
      await onAssign(ticket.id, selectedAgentId);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error asignando agente.");
    } finally {
      setAssigning(false);
    }
  };

  // Legacy Description Parser (Keep for backward compatibility)
  const parseDescription = (desc?: string) => {
    if (!desc) return [];
    const parts = desc.split(/\n\n\[/);
    return parts.slice(1).map((part) => {
      const closeBracketIndex = part.indexOf("]");
      if (closeBracketIndex === -1) return { date: "", text: part };
      const date = part.substring(0, closeBracketIndex);
      const text = part
        .substring(closeBracketIndex + 1)
        .replace(" SEGUIMIENTO: ", "")
        .trim();
      return { date, text, isLegacy: true };
    });
  };
  const legacyUpdates = parseDescription(ticket.description);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 border border-gray-200">
        {/* HEADER */}
        <div className="bg-gray-900 text-white p-5 flex justify-between items-start shrink-0 relative">
          {/* Gradient Accent */}
          <div
            className={`absolute top-0 left-0 w-2 h-full ${
              ticket.ticket_type === "INC" ? "bg-red-500" : "bg-blue-500"
            }`}
          ></div>

          <div className="pl-4">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {ticket.ticket_code || `Ticket #${ticket.id}`}
                {ticket.is_vip_ticket && (
                  <span className="text-yellow-400">
                    <Clock className="w-4 h-4 text-yellow-500 inline mr-1" />
                    VIP
                  </span>
                )}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                  ticket.status === "RESUELTO" || ticket.status === "CERRADO"
                    ? "bg-green-500/20 text-green-300 border-green-500/50"
                    : ticket.status === "EN_PROGRESO"
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                    : ticket.status === "EN_ESPERA"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                    : "bg-red-500/20 text-red-300 border-red-500/50"
                }`}
              >
                {ticket.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Creado: {new Date(ticket.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* PAUSE / RESUME CONTROLS */}
            {ticket.status !== "RESUELTO" && ticket.status !== "CERRADO" && (
              <>
                {ticket.sla_status === "paused" ? (
                  <button
                    onClick={handleResume}
                    disabled={processingAction}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    <PlayCircle className="w-4 h-4" /> Reanudar SLA
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setShowPauseInput(!showPauseInput)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      <PauseCircle className="w-4 h-4" /> Pausar / Congelar
                    </button>
                    {showPauseInput && (
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 text-gray-800 p-3 z-50">
                        <label className="text-xs font-bold block mb-2">
                          Motivo de Pausa
                        </label>
                        <select
                          className="w-full text-xs border rounded p-1.5 mb-2 bg-gray-50"
                          value={selectedReason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                        >
                          <option value="">Seleccione...</option>
                          {pauseReasons.map((r) => (
                            <option key={r.id} value={r.description}>
                              {r.description}
                            </option>
                          ))}
                          <option value="OTHER">Otro...</option>
                        </select>
                        {selectedReason === "OTHER" && (
                          <input
                            type="text"
                            placeholder="Especifique motivo..."
                            className="w-full text-xs border rounded p-1.5 mb-2"
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                          />
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setShowPauseInput(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handlePause}
                            disabled={processingAction || !selectedReason}
                            className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition ml-4 bg-white/10 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LEFT COLUMN: Details */}
            <div className="md:col-span-1 space-y-4">
              {/* Asset Info */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5" /> Equipo Afectado
                </h3>
                {ticket.assets ? (
                  <div>
                    <p className="font-bold text-gray-800 text-sm">
                      {ticket.assets.type}
                    </p>
                    <p className="text-xs text-gray-600">
                      {ticket.assets.model}
                    </p>
                    <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded block w-fit mt-1 text-gray-500">
                      {ticket.assets.serial_number}
                    </code>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No especificado
                  </p>
                )}
              </div>

              {/* User Info */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Solicitante
                </h3>
                <p className="font-bold text-gray-800 text-sm">
                  {ticket.users?.full_name}
                </p>
                <p className="text-xs text-gray-600 mb-2">
                  {ticket.users?.area}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 w-fit px-2 py-0.5 rounded">
                  <MapPin className="w-3 h-3" /> {ticket.location}
                </div>
              </div>

              {/* Agent Assignment */}
              {onAssign && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">
                    Agente Asignado
                  </h3>
                  <select
                    className="w-full border p-1.5 rounded text-xs bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none"
                    value={selectedAgentId || ""}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                  >
                    <option value="">-- Sin Asignar --</option>
                    {agents
                      .filter((a) => a.role === "agent")
                      .map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={
                      assigning || selectedAgentId === ticket.assigned_agent_id
                    }
                    className="w-full mt-2 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs py-1.5 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigning ? "..." : "Actualizar Agente"}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Description & Audit */}
            <div className="md:col-span-2 space-y-4">
              {/* Description */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />{" "}
                  Descripción del Problema
                </h3>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 border border-gray-100 leading-relaxed whitespace-pre-wrap">
                  {ticket.description?.split("\n\n[")[0] || "Sin descripción"}
                </div>
              </div>

              {/* Add Comment Section */}
              {onAddComment && (
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" /> Agregar
                    Seguimiento
                  </h3>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows={3}
                    placeholder="Escribe un comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex justify-end mt-2 gap-2">
                    {onUpdateStatus &&
                      ticket.status !== "RESUELTO" &&
                      ticket.status !== "CERRADO" && (
                        <button
                          onClick={async () => {
                            if (!newComment.trim())
                              return alert(
                                "Escribe una solución/comentario primero."
                              );
                            if (confirm("¿Resolver ticket?")) {
                              setSubmittingComment(true);
                              await onUpdateStatus(ticket.id, "RESUELTO");
                              if (onAddComment)
                                await onAddComment(ticket.id, newComment); // Log solution
                              setSubmittingComment(false);
                              onClose();
                            }
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold"
                          disabled={submittingComment}
                        >
                          Resolver
                        </button>
                      )}
                    <button
                      onClick={async () => {
                        if (!newComment.trim()) return;
                        setSubmittingComment(true);
                        await onAddComment(ticket.id, newComment);
                        setNewComment("");
                        setSubmittingComment(false);
                        // Refresh events logic would be ideal here calling internal fetchDetails again
                        // But for now we rely on parent refresh or optimistic update?
                        // Actually, we should probably re-fetch events here.
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold disabled:opacity-50"
                      disabled={submittingComment || !newComment.trim()}
                    >
                      {submittingComment ? "Enviando..." : "Enviar Comentario"}
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Log / Timeline */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm min-h-[300px]">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                  <Clock className="w-4 h-4 text-gray-400" /> Historial de
                  Eventos
                  {loadingEvents && (
                    <span className="text-[10px] text-gray-400 font-normal ml-2 animate-pulse">
                      Cargando...
                    </span>
                  )}
                </h3>

                <div className="relative border-l-2 border-gray-100 ml-2 space-y-6">
                  {/* Timeline Logic Extracted for Safety */}
                  {[
                    ...legacyUpdates.map((u) => ({
                      type: "legacy" as const,
                      date: new Date(u.date).getTime(),
                      displayDate: u.date,
                      text: u.text,
                      title: "Nota de Seguimiento",
                      actor: undefined,
                      rawType: undefined,
                    })),
                    ...events.map((e) => ({
                      type: "event" as const,
                      date: new Date(e.created_at).getTime(),
                      displayDate: new Date(e.created_at).toLocaleString(),
                      text: e.comment
                        ? e.comment
                        : `${e.old_value || "?"} ➔ ${e.new_value || "?"}`,
                      title:
                        e.action_type === "STATUS_CHANGE"
                          ? "Cambio de Estado"
                          : e.action_type === "PAUSED"
                          ? "Ticket Pausado"
                          : e.action_type === "RESUMED"
                          ? "Ticket Reanudado"
                          : e.action_type,
                      actor: e.actor_name,
                      rawType: e.action_type,
                    })),
                    {
                      type: "creation" as const,
                      date: new Date(ticket.created_at).getTime(),
                      displayDate: new Date(ticket.created_at).toLocaleString(),
                      title: "Ticket Creado",
                      text: undefined,
                      actor: undefined,
                      rawType: undefined,
                    },
                  ]
                    .sort((a, b) => b.date - a.date)
                    .map((item, idx) => (
                      <div key={idx} className="relative pl-6 group">
                        <div
                          className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 
                                  ${
                                    item.rawType === "PAUSED"
                                      ? "bg-purple-500 ring-purple-200"
                                      : item.rawType === "RESUMED"
                                      ? "bg-green-500 ring-green-200"
                                      : item.type === "legacy"
                                      ? "bg-blue-400 ring-blue-100"
                                      : item.type === "creation"
                                      ? "bg-gray-300 ring-gray-200"
                                      : "bg-gray-400 ring-gray-200"
                                  }`}
                        ></div>

                        <div className="flex justify-between items-start">
                          <h4
                            className={`font-bold text-xs ${
                              item.rawType === "PAUSED"
                                ? "text-purple-700"
                                : "text-gray-700"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-gray-400">
                            {item.displayDate}
                          </span>
                        </div>

                        {item.actor && (
                          <p className="text-[10px] text-gray-400 mb-1">
                            por{" "}
                            <span className="font-medium text-gray-600">
                              {item.actor}
                            </span>
                          </p>
                        )}

                        {item.text && (
                          <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                            {item.text}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
