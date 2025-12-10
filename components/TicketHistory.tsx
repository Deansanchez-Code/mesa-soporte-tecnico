"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import TicketDetailsModal from "@/components/TicketDetailsModal";
import { Ticket } from "@/app/admin/types";
import { Search, Filter, FileText, Zap, Download } from "lucide-react";

export default function TicketHistory() {
  // Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, RESOLVED, CLOSED, ACTIVE
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Fetch Logic
  const fetchHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tickets")
        .select(
          `
            *,
            users:users!tickets_user_id_fkey ( full_name, area ),
            assigned_agent:users!tickets_assigned_agent_id_fkey ( full_name ),
            assets ( model, type, serial_number )
          `
        )
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (statusFilter === "RESOLVED") {
        query = query.in("status", ["RESUELTO", "CERRADO"]);
      } else if (statusFilter === "ACTIVE") {
        query = query.in("status", ["PENDIENTE", "EN_PROGRESO", "EN_ESPERA"]);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data as Ticket[]) || [];

      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            (t.ticket_code && t.ticket_code.toLowerCase().includes(lowerQ)) ||
            (t.description && t.description.toLowerCase().includes(lowerQ)) ||
            (t.users?.full_name &&
              t.users.full_name.toLowerCase().includes(lowerQ))
        );
      }

      setTickets(filtered);
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter, searchQuery]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const downloadReport = () => {
    const csvContent = [
      [
        "ID",
        "Fecha",
        "Codigo",
        "Usuario",
        "Ubicación",
        "Categoría",
        "Activo",
        "Estado",
        "Agente",
      ],
      ...tickets.map((t) => [
        t.id,
        new Date(t.created_at).toLocaleDateString(),
        t.ticket_code,
        t.users?.full_name || "N/A",
        t.location,
        t.category,
        t.assets?.model || t.asset_serial || "N/A",
        t.status,
        t.assigned_agent?.full_name || "N/A",
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
      `reporte_historial_${startDate}_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full animate-in fade-in">
      {/* TOOLBAR */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Fechas */}
          <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-gray-200">
            <div className="px-2">
              <label className="text-[10px] font-bold text-gray-500 block">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs outline-none text-gray-700 bg-transparent font-medium"
              />
            </div>
            <div className="h-6 w-[1px] bg-gray-200"></div>
            <div className="px-2">
              <label className="text-[10px] font-bold text-gray-500 block">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs outline-none text-gray-700 bg-transparent font-medium"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-sena-green outline-none h-[38px] bg-white text-gray-700 font-medium"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activos (Pendientes/Proceso)</option>
              <option value="RESOLVED">Resueltos / Cerrados</option>
            </select>
          </div>

          <button
            onClick={fetchHistory}
            className="bg-sena-green text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-green-700 transition shadow-sm flex items-center gap-2 h-[38px]"
          >
            <Filter className="w-3 h-3" /> Filtrar
          </button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ticket..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-sena-green outline-none h-[38px]"
              onKeyDown={(e) => e.key === "Enter" && fetchHistory()}
            />
          </div>

          <button
            onClick={downloadReport}
            disabled={tickets.length === 0}
            className="border border-gray-300 bg-white text-gray-600 px-3 py-2 rounded-lg font-bold text-xs hover:bg-gray-50 transition flex items-center gap-2 h-[38px] disabled:opacity-50"
            title="Descargar CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RESULTADOS */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-400 gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
            <span className="text-sm">Cargando datos...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <Search className="w-12 h-12 mb-3 text-gray-200" />
            <p className="text-sm font-medium">
              No se encontraron tickets con esos filtros.
            </p>
            <p className="text-xs">Intenta cambiar las fechas o el estado.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">
                  Solicitante
                </th>
                <th className="px-6 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">
                  Ubicación / Equipo
                </th>
                <th className="px-6 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">
                  Agente
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="hover:bg-blue-50/50 transition cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`p-1.5 rounded-lg ${
                          ticket.ticket_type === "INC"
                            ? "bg-red-100 text-red-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {ticket.ticket_type === "INC" ? (
                          <Zap className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">
                          {ticket.ticket_code || `#${ticket.id}`}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase font-medium">
                          {ticket.category}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(ticket.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                        {ticket.users?.full_name?.charAt(0) || "?"}
                      </div>
                      <span className="font-medium text-gray-700">
                        {ticket.users?.full_name || "Desconocido"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-700 text-xs font-medium">
                        {ticket.location}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {ticket.assets
                          ? `${ticket.assets.type} ${ticket.assets.model}`
                          : "Sin equipo asignado"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        ticket.status === "RESUELTO" ||
                        ticket.status === "CERRADO"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : ticket.status === "EN_PROGRESO"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : ticket.status === "EN_ESPERA"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-600 font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      {ticket.assigned_agent?.full_name || "Sin Asignar"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* INFO FOOTER */}
      <div className="bg-gray-50 border-t border-gray-200 p-2 px-4 text-xs text-gray-400 flex justify-between">
        <span>{tickets.length} registros encontrados</span>
        <span>Mostrando los últimos 30 días por defecto</span>
      </div>

      {/* DETAILS MODAL */}
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          agents={[]}
        />
      )}
    </div>
  );
}
