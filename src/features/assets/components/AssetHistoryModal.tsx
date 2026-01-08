"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { History, X, Calendar, User, Wrench, CheckCircle } from "lucide-react";

interface AssetHistoryModalProps {
  serialNumber: string;
  onClose: () => void;
}

interface TicketHistory {
  id: number;
  created_at: string;
  category: string;
  status: string;
  users: { full_name: string } | null; // El técnico que lo atendió (o usuario solicitante si no hay técnico)
  assigned_agent_id: string;
}

export default function AssetHistoryModal({
  serialNumber,
  onClose,
}: AssetHistoryModalProps) {
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      // Buscamos tickets donde el serial coincida y NO sea el ticket actual (opcional, aquí traemos todos)
      const { data } = await supabase
        .from("tickets")
        .select(
          `
          id,
          created_at,
          category,
          status,
          assigned_agent_id,
          users ( full_name )
        `,
        )
        .eq("asset_serial", serialNumber)
        .order("created_at", { ascending: false }); // Los más recientes primero

      if (data) setHistory(data as unknown as TicketHistory[]);
      setLoading(false);
    }

    fetchHistory();
  }, [serialNumber]);

  // Función para formatear fecha bonita
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-sena-green" />
            <div>
              <h3 className="font-bold text-sm">Historial del Activo</h3>
              <p className="text-xs text-gray-300 font-mono tracking-wider">
                {serialNumber}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:text-gray-300 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              Cargando antecedentes...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
              <p className="text-gray-600 font-medium">
                Este equipo no tiene reportes previos.
              </p>
              <p className="text-xs text-gray-400">¡Es un equipo sano!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                {history.length} Eventos registrados
              </p>

              {history.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex gap-3 relative overflow-hidden"
                >
                  {/* Línea de estado visual */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      ticket.status === "RESOLVED" || ticket.status === "CLOSED"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  ></div>

                  <div className="flex-1 pl-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        Ticket #{ticket.id}
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Calendar className="w-3 h-3" />{" "}
                        {formatDate(ticket.created_at)}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-gray-400" />
                        {ticket.category}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        {ticket.users?.full_name.split(" ")[0]} (Solicitante)
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          ticket.status === "RESOLVED" ||
                          ticket.status === "CLOSED"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }`}
                      >
                        {ticket.status === "RESOLVED"
                          ? "RESUELTO"
                          : ticket.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
