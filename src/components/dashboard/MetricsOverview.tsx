import React, { useState } from "react";
import { BarChart2, Monitor } from "lucide-react";
import { Ticket } from "@/app/admin/types";
import { User } from "@supabase/supabase-js";

interface MetricsOverviewProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  currentUser: User | null;
}

export function MetricsOverview({
  isOpen,
  onClose,
  tickets,
  currentUser,
}: MetricsOverviewProps) {
  // Estados para filtros de métricas
  const [metricsStartDate, setMetricsStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [metricsEndDate, setMetricsEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  if (!isOpen) return null;

  const downloadReport = () => {
    if (!currentUser) return;

    const filteredTickets = tickets.filter((t) => {
      const isResolved = t.status === "RESUELTO" || t.status === "CERRADO";
      const isMine =
        t.assigned_agent_id === currentUser.id ||
        (t.assigned_agent &&
          t.assigned_agent.full_name === currentUser.user_metadata?.full_name);

      const ticketDate = new Date((t.created_at as string) || "");
      const start = new Date(metricsStartDate as string);
      const end = new Date(metricsEndDate as string);
      end.setHours(23, 59, 59); // Incluir todo el día final

      return isResolved && isMine && ticketDate >= start && ticketDate <= end;
    });

    const csvContent = [
      [
        "ID",
        "Fecha",
        "Usuario",
        "Ubicación",
        "Categoría",
        "Modelo Equipo",
        "Estado",
      ],
      ...filteredTickets.map((t) => [
        t.id,
        new Date(t.created_at || "").toLocaleDateString(),
        t.users?.full_name || "N/A",
        t.location,
        t.category,
        t.assets?.model || "N/A",
        t.status,
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `reporte_agente_${metricsStartDate}_${metricsEndDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-sena-blue" />
            Mis Métricas (Mes Actual)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="bg-blue-50 rounded-xl p-6 text-center border border-blue-100 mb-6">
          <div className="flex gap-2 mb-4 justify-center">
            <input
              type="date"
              value={metricsStartDate}
              onChange={(e) => setMetricsStartDate(e.target.value)}
              className="border rounded p-1 text-xs"
            />
            <span className="self-center">-</span>
            <input
              type="date"
              value={metricsEndDate}
              onChange={(e) => setMetricsEndDate(e.target.value)}
              className="border rounded p-1 text-xs"
            />
          </div>

          <p className="text-sm text-blue-600 font-bold uppercase mb-1">
            Casos Resueltos
          </p>
          <p className="text-5xl font-extrabold text-sena-blue">
            {
              tickets.filter((t) => {
                try {
                  if (!currentUser) return false;
                  // Filtramos por: Resuelto/Cerrado, Asignado a mí, Rango de fechas
                  const isResolved =
                    t.status === "RESUELTO" || t.status === "CERRADO";
                  // Usamos currentUser.id que cargamos del localStorage
                  // Nota: assigned_agent_id es el ID, currentUser.id debería coincidir
                  const isMine =
                    t.assigned_agent_id === currentUser.id ||
                    (t.assigned_agent &&
                      t.assigned_agent.full_name ===
                        currentUser.user_metadata?.full_name);

                  const ticketDate = new Date((t.created_at as string) || "");
                  const start = new Date(metricsStartDate as string);
                  const end = new Date(metricsEndDate as string);
                  end.setHours(23, 59, 59);

                  return (
                    isResolved &&
                    isMine &&
                    ticketDate >= start &&
                    ticketDate <= end
                  );
                } catch {
                  return false;
                }
              }).length
            }
          </p>

          <button
            onClick={downloadReport}
            className="mt-4 bg-sena-blue text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-800 transition flex items-center gap-2 mx-auto"
          >
            <BarChart2 className="w-4 h-4" /> Descargar Reporte
          </button>
        </div>

        {/* TOP EQUIPOS CON FALLAS */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-orange-500" />
            Equipos con más fallas
          </h4>
          <div className="space-y-2">
            {Object.entries(
              tickets.reduce(
                (acc, ticket) => {
                  if (!ticket.assets) return acc;
                  const key = `${ticket.assets.type} ${ticket.assets.model} (${ticket.assets.serial_number})`;
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([name, count], index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 last:border-0"
                >
                  <span
                    className="text-gray-600 truncate max-w-[200px]"
                    title={name}
                  >
                    {index + 1}. {name}
                  </span>
                  <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    {count} fallas
                  </span>
                </div>
              ))}
            {tickets.filter((t) => t.assets).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                No hay datos de equipos aún.
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-center text-gray-400">
          * Solo se cuentan los tickets donde tú marcaste la solución.
        </p>
      </div>
    </div>
  );
}
