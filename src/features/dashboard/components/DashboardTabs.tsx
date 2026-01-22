"use client";

import { LayoutDashboard, History, Snowflake, RefreshCw } from "lucide-react";

interface DashboardTabsProps {
  viewMode: "KANBAN" | "HISTORY" | "ENVIRONMENTS";
  setViewMode: (mode: "KANBAN" | "HISTORY" | "ENVIRONMENTS") => void;
  showFreezer: boolean;
  setShowFreezer: (show: boolean) => void;
  waitingTicketsCount: number;
  loading: boolean;
  fetchTickets: () => void;
}

export default function DashboardTabs({
  viewMode,
  setViewMode,
  showFreezer,
  setShowFreezer,
  waitingTicketsCount,
  loading,
  fetchTickets,
}: DashboardTabsProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4 items-center">
      {/* TABS */}
      <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm relative">
        <button
          onClick={() => setViewMode("KANBAN")}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
            viewMode === "KANBAN"
              ? "bg-blue-50 text-sena-blue shadow-sm ring-1 ring-blue-100"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Tablero de Gestión
        </button>
        <button
          onClick={() => setViewMode("HISTORY")}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
            viewMode === "HISTORY"
              ? "bg-blue-50 text-sena-blue shadow-sm ring-1 ring-blue-100"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }`}
        >
          <History className="w-4 h-4" /> Historial Completo
        </button>
      </div>

      <div className="flex gap-3">
        {viewMode === "KANBAN" && (
          <button
            onClick={() => setShowFreezer(!showFreezer)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border cursor-pointer ${
              waitingTicketsCount > 0
                ? "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Snowflake
              className={`w-4 h-4 ${
                waitingTicketsCount > 0 ? "animate-pulse" : ""
              }`}
            />
            Rep. y Garantías ({waitingTicketsCount})
          </button>
        )}

        <button
          onClick={() => {
            fetchTickets();
          }}
          className="flex items-center gap-2 text-gray-500 hover:text-sena-blue text-sm font-medium cursor-pointer transition-colors bg-white px-3 py-2 rounded-lg border border-gray-200 hover:border-sena-blue shadow-sm"
          title="Recargar datos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
