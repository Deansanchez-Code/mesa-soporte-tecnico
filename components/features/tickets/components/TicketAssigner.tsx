import React, { useState } from "react";
import { toast } from "sonner";
import { Ticket } from "@/app/admin/types";
import Logger from "@/lib/logger";

interface TicketAssignerProps {
  ticket: Ticket;
  agents: { id: string; full_name: string; role: string }[];
  onAssign?: (ticketId: number, agentId: string) => Promise<void>;
  onClose?: () => void;
}

export const TicketAssigner = ({
  ticket,
  agents,
  onAssign,
  onClose,
}: TicketAssignerProps) => {
  const [selectedAgentId, setSelectedAgentId] = useState(
    ticket.assigned_agent_id || "",
  );
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!onAssign || !selectedAgentId) return;
    setAssigning(true);
    try {
      await onAssign(ticket.id, selectedAgentId);
      toast.success("Agente asignado correctamente");
      if (onClose) onClose();
    } catch (e) {
      Logger.error("Error asignando agente", e);
      toast.error("Error asignando agente");
    } finally {
      setAssigning(false);
    }
  };

  if (!onAssign) return null;

  return (
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
        disabled={assigning || selectedAgentId === ticket.assigned_agent_id}
        className="w-full mt-2 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs py-1.5 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {assigning ? "..." : "Actualizar Agente"}
      </button>
    </div>
  );
};
