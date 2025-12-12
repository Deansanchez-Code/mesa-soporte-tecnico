"use client";

import React, { useState } from "react";
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
import { useTicketDetails } from "./hooks/useTicketDetails";

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
  // --- UI State (Local) ---
  const [selectedAgentId, setSelectedAgentId] = useState(
    ticket.assigned_agent_id || ""
  );
  const [assigning, setAssigning] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Pause UI State
  const [showPauseInput, setShowPauseInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  // --- Business Logic Hook ---
  const {
    loadingEvents,
    pauseReasons,
    processingAction,
    timelineItems,
    handlePause,
    handleResume,
    refreshEvents,
  } = useTicketDetails({
    ticket,
    currentUser,
    onSuccess: onClose, // Close modal after status change
  });

  // --- Handlers Wrappers ---

  const onConfirmPause = async () => {
    await handlePause(selectedReason, customReason);
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

  const handleSendComment = async () => {
    if (!newComment.trim() || !onAddComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(ticket.id, newComment);
      setNewComment("");
      // Refresh events to show the new comment immediately in timeline (if backend saves it as event or log)
      // Note: onAddComment logic in parent usually inserts into ticket_events or updates description.
      // If it inserts into `ticket_events`, we should refresh.
      await refreshEvents();
    } catch (e) {
      console.error("Error sending comment:", e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleResolve = async () => {
    if (!newComment.trim()) {
      return alert("Escribe una solución/comentario primero.");
    }
    if (!onUpdateStatus || !onAddComment) return;

    if (confirm("¿Resolver ticket?")) {
      setSubmittingComment(true);
      try {
        await onUpdateStatus(ticket.id, "RESUELTO");
        await onAddComment(ticket.id, newComment);
        onClose();
      } catch (e) {
        console.error(e);
      } finally {
        setSubmittingComment(false);
      }
    }
  };

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
                    onClick={() => handleResume()}
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
                            onClick={onConfirmPause}
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
                          onClick={handleResolve}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold"
                          disabled={submittingComment}
                        >
                          Resolver
                        </button>
                      )}
                    <button
                      onClick={handleSendComment}
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
                  {timelineItems.map((item, idx) => (
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
