"use client";

import React from "react";

import {
  X,
  User,
  MapPin,
  Calendar,
  Monitor,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Ticket {
  id: number;
  category: string;
  status: string;
  location: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  solution?: string | null;
  assigned_agent_id?: string | null; // Added field
  users: {
    full_name: string;
    area: string;
  } | null;
  assigned_agent?: {
    full_name: string;
  } | null;
  assets: {
    model: string;
    type: string;
    serial_number: string;
  } | null;
}

interface TicketDetailsModalProps {
  ticket: Ticket;
  agents?: { id: string; full_name: string; role: string }[];
  onAssign?: (ticketId: number, agentId: string) => Promise<void>;
  onClose: () => void;
}

export default function TicketDetailsModal({
  ticket,
  onClose,
  agents = [],
  onAssign,
}: TicketDetailsModalProps) {
  // Estado local para la selección de agente
  const [selectedAgentId, setSelectedAgentId] = React.useState(
    ticket.assigned_agent_id || ""
  );

  const [assigning, setAssigning] = React.useState(false);

  // Función para parsear la descripción y separar los comentarios agregados
  const parseDescription = (
    desc?: string
  ): { initial: string; updates: { date: string; text: string }[] } => {
    if (!desc) return { initial: "", updates: [] };
    const parts = desc.split(/\n\n\[/);
    const initial = parts[0];
    const updates = parts.slice(1).map((part) => {
      const closeBracketIndex = part.indexOf("]");
      if (closeBracketIndex === -1) return { date: "", text: part };

      const date = part.substring(0, closeBracketIndex);
      const text = part
        .substring(closeBracketIndex + 1)
        .replace(" SEGUIMIENTO: ", "")
        .trim();
      return { date, text };
    });

    return { initial, updates };
  };

  const { initial, updates } = parseDescription(ticket.description);

  // Filter agents: Exclude admins from being assigned
  const assignableAgents = agents.filter((a) => a.role === "agent");

  const handleAssign = async () => {
    if (!onAssign || !selectedAgentId) return;
    setAssigning(true);
    try {
      await onAssign(ticket.id, selectedAgentId);
      // Close modal or show success? Parent handles refresh.
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error asignando agente.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4">
        {/* HEADER */}
        <div className="bg-gray-800 text-white p-5 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold">Ticket #{ticket.id}</h2>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                  ticket.status === "RESUELTO" || ticket.status === "CERRADO"
                    ? "bg-green-500 text-white"
                    : ticket.status === "EN_PROGRESO"
                    ? "bg-blue-500 text-white"
                    : ticket.status === "EN_ESPERA"
                    ? "bg-purple-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {ticket.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Creado el {new Date(ticket.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
          {/* GESTIÓN DE AGENTE (Solo si se pasan agentes y función) */}
          {onAssign && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Asignar Agente
                </label>
                <select
                  className="w-full border p-2 rounded text-sm"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">-- Sin Asignar --</option>
                  {assignableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedAgentId}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 mt-4"
              >
                {assigning ? "..." : "Asignar"}
              </button>
            </div>
          )}

          {/* INFO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SOLICITANTE */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Solicitante
              </h3>
              <p className="font-bold text-gray-800">
                {ticket.users?.full_name || "Desconocido"}
              </p>
              <p className="text-sm text-gray-600">
                {ticket.users?.area || "Sin área"}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 bg-gray-100 w-fit px-2 py-1 rounded">
                <MapPin className="w-3 h-3" /> {ticket.location}
              </div>
            </div>

            {/* ACTIVO / EQUIPO */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Equipo Reportado
              </h3>
              {ticket.assets ? (
                <>
                  <p className="font-bold text-gray-800">
                    {ticket.assets.type} {ticket.assets.model}
                  </p>
                  <p className="text-sm text-gray-600 font-mono">
                    SN: {ticket.assets.serial_number}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No se especificó un equipo.
                </p>
              )}
            </div>
          </div>

          {/* LÍNEA DE TIEMPO (TRAZABILIDAD) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sena-blue" /> Trazabilidad del Caso
            </h3>

            <div className="relative border-l-2 border-gray-200 ml-3 space-y-8">
              {/* 1. CREACIÓN */}
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-200 border-2 border-white"></div>
                <p className="text-xs text-gray-400 mb-1">
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
                <h4 className="font-bold text-sm text-gray-800">
                  Ticket Creado
                </h4>
                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {initial || "Sin descripción inicial."}
                </div>
              </div>

              {/* 2. ACTUALIZACIONES / COMENTARIOS */}
              {updates.map(
                (update: { date: string; text: string }, idx: number) => (
                  <div key={idx} className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-200 border-2 border-white"></div>
                    <p className="text-xs text-gray-400 mb-1">{update.date}</p>
                    <h4 className="font-bold text-sm text-purple-700">
                      Seguimiento / Comentario
                    </h4>
                    <p className="text-sm text-gray-700 mt-1">{update.text}</p>
                  </div>
                )
              )}

              {/* 3. SOLUCIÓN (Si existe) */}
              {ticket.solution && (
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
                  <p className="text-xs text-gray-400 mb-1">
                    {ticket.updated_at
                      ? new Date(ticket.updated_at).toLocaleString()
                      : "Fecha desconocida"}
                  </p>
                  <h4 className="font-bold text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Caso Resuelto
                  </h4>
                  <div className="mt-2 text-sm text-gray-700 bg-green-50 p-3 rounded-lg border border-green-100">
                    <span className="font-bold text-green-800 block mb-1">
                      Solución:
                    </span>
                    {ticket.solution}
                  </div>
                  {ticket.assigned_agent && (
                    <p className="text-xs text-gray-500 mt-2">
                      Atendido por:{" "}
                      <span className="font-bold">
                        {ticket.assigned_agent.full_name}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
