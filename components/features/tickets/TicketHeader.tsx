import React, { useState } from "react";
import { X, Calendar, Clock, PlayCircle, PauseCircle } from "lucide-react";
import { Ticket } from "@/app/admin/types";

interface TicketHeaderProps {
  ticket: Ticket;
  onClose: () => void;
  onResume: () => Promise<void>;
  onPause: (reason: string, customReason: string) => Promise<void>;
  processingAction: boolean;
  pauseReasons: { id: number; description: string }[];
}

export function TicketHeader({
  ticket,
  onClose,
  onResume,
  onPause,
  processingAction,
  pauseReasons,
}: TicketHeaderProps) {
  const [showPauseInput, setShowPauseInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const handleConfirmPause = async () => {
    await onPause(selectedReason, customReason);
    setShowPauseInput(false);
    setSelectedReason("");
    setCustomReason("");
  };

  return (
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
          Creado:{" "}
          {ticket.created_at
            ? new Date(ticket.created_at).toLocaleString()
            : "N/A"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* PAUSE / RESUME CONTROLS */}
        {ticket.status !== "RESUELTO" && ticket.status !== "CERRADO" && (
          <>
            {ticket.sla_status === "paused" ? (
              <button
                onClick={onResume}
                disabled={processingAction}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
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
                        onClick={handleConfirmPause}
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
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
