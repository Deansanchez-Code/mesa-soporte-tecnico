"use client";

import React, { useState } from "react";
import { X, User, MapPin, Monitor, MessageSquare } from "lucide-react";
import { Ticket } from "@/app/admin/types";
import { useTicketDetails } from "./hooks/useTicketDetails";
import { toast } from "sonner";
import { TicketHeader } from "./TicketHeader";
import { TicketSLAStatus } from "./TicketSLAStatus";
import { TicketTimeline } from "./TicketTimeline";
import { TicketActions } from "./TicketActions";

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
    ticket.assigned_agent_id || "",
  );
  const [assigning, setAssigning] = useState(false);

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

  const handleAssign = async () => {
    if (!onAssign || !selectedAgentId) return;
    setAssigning(true);
    try {
      await onAssign(ticket.id, selectedAgentId);
      toast.success("Agente asignado correctamente");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Error asignando agente");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
        <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 border border-gray-200">
          <TicketHeader
            ticket={ticket}
            onClose={onClose}
            onResume={handleResume}
            onPause={handlePause}
            processingAction={processingAction}
            pauseReasons={pauseReasons}
          />

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

                  {/* SLA Info */}
                  <TicketSLAStatus ticket={ticket} />

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
                        assigning ||
                        selectedAgentId === ticket.assigned_agent_id
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
                <TicketActions
                  ticket={ticket}
                  onAddComment={onAddComment}
                  onUpdateStatus={onUpdateStatus}
                  onCommentAdded={refreshEvents}
                  onSuccess={onClose}
                />

                {/* Audit Log / Timeline */}
                <TicketTimeline
                  loadingEvents={loadingEvents}
                  timelineItems={timelineItems}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
