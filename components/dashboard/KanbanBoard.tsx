import React, { useState } from "react";
import { Ticket } from "@/app/admin/types";
import { User } from "@supabase/supabase-js";
import {
  Zap,
  FileText,
  Crown,
  Clock,
  MapPin,
  Monitor,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Snowflake,
} from "lucide-react";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { safeGetItem } from "@/lib/storage";

interface KanbanBoardProps {
  tickets: Ticket[]; // Base tickets list if needed for lookups, though filtered lists are passed
  pendingTickets: Ticket[];
  inProgressTickets: Ticket[];
  resolvedTickets: Ticket[];
  waitingTickets: Ticket[];
  agents: { id: string; full_name: string; role: string }[];
  currentUser: User | null;

  // Actions
  onUpdateStatus: (ticketId: number, newStatus: string) => Promise<void>;
  onReassign: (ticketId: number, newAgentId: string) => Promise<void>;
  onToggleHold: (ticket: Ticket) => Promise<void>;
  onPromptAddComment: (
    ticketId: number,
    currentDescription: string,
  ) => Promise<void>;
  onCategoryChange: (ticketId: number, newCategory: string) => Promise<void>;

  // State Setters
  setSelectedTicket: (ticket: Ticket | null) => void;
  setSelectedAssetSerial: (serial: string | null) => void;
  setResolvingTicketId: (ticketId: number | null) => void;

  // Freezer UI Control
  showFreezer: boolean;
}

export function KanbanBoard({
  pendingTickets,
  inProgressTickets,
  resolvedTickets,
  waitingTickets,
  agents,
  onUpdateStatus,
  onReassign,
  onToggleHold,
  onPromptAddComment,
  onCategoryChange,
  setSelectedTicket,
  setSelectedAssetSerial,
  setResolvingTicketId,
  showFreezer,
}: KanbanBoardProps) {
  const [isResolvedCollapsed, setIsResolvedCollapsed] = useState(false);

  // --- HELPERS ---
  const getPriorityColor = (ticket: Ticket) => {
    if (ticket.ticket_type === "INC") return "border-l-4 border-l-red-500";
    if (ticket.ticket_type === "REQ") return "border-l-4 border-l-blue-500";
    return "border-l-4 border-l-gray-300";
  };

  const getTimeAgo = (dateString?: string | null) => {
    if (!dateString) return "Reciente";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${diffDays} días`;
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    ticketId: number,
  ) => {
    e.dataTransfer.setData("ticketId", ticketId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necesario para permitir el drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    newStatus: string,
  ) => {
    e.preventDefault();
    const ticketIdStr = e.dataTransfer.getData("ticketId");
    if (!ticketIdStr) return;

    const ticketId = parseInt(ticketIdStr, 10);
    if (isNaN(ticketId)) return;

    // Call prop update
    // Note: Validation if status changed is done implicitly by backend/hook logic or could be added here
    // But since we don't have the full ticket object easily here without searching, we rely on the action.
    await onUpdateStatus(ticketId, newStatus);
  };

  return (
    <>
      {/* --- SECCIÓN DEL CONGELADOR (Expansible) --- */}
      {showFreezer && (
        <div className="mb-8 bg-purple-50 rounded-xl p-5 border-2 border-dashed border-purple-200 animate-in slide-in-from-top-4">
          <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-4 text-lg">
            <Snowflake className="w-6 h-6" /> Repuestos y Garantías
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {waitingTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm opacity-90 hover:opacity-100 transition hover:shadow-md cursor-pointer"
                onClick={(e) => {
                  // Evitar abrir modal si se hace clic en botones
                  if ((e.target as HTMLElement).closest("button")) return;
                  setSelectedTicket(ticket);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1 items-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                          ticket.ticket_type === "INC"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {ticket.ticket_type === "INC" ? (
                          <Zap className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {ticket.ticket_code || `#${ticket.id}`}
                      </span>
                      <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                        <PauseCircle className="w-3 h-3" /> PAUSADO
                      </span>
                      {ticket.is_vip_ticket && (
                        <span
                          className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-200"
                          title="Usuario VIP"
                        >
                          <Crown className="w-3 h-3" /> VIP
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 text-[10px] text-gray-400"
                    title={`Actualizado: ${new Date(
                      ticket.updated_at || ticket.created_at || "",
                    ).toLocaleString()}`}
                  >
                    <Clock className="w-3 h-3" />
                    {getTimeAgo(ticket.updated_at || ticket.created_at || "")}
                  </div>
                </div>

                <p className="font-bold text-gray-800 text-sm mb-1">
                  {ticket.users?.full_name}
                </p>
                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                  <Monitor className="w-3 h-3" />{" "}
                  {ticket.assets?.model || "Equipo General"}
                </p>

                <button
                  onClick={() =>
                    onPromptAddComment(ticket.id, ticket.description || "")
                  }
                  className="w-full mb-2 bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span className="text-[10px]">💬</span> Agregar Seguimiento
                </button>

                {/* Botón para REANUDAR */}
                <button
                  onClick={() => onToggleHold(ticket)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Reanudar SLA
                </button>
              </div>
            ))}

            {waitingTickets.length === 0 && (
              <p className="text-sm text-purple-400 italic py-4 col-span-full text-center">
                No hay equipos para repuestos ni garantias... ¡Buen trabajo!
                👌👍
              </p>
            )}
          </div>
        </div>
      )}

      {/* --- GRID KANBAN PRINCIPAL --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto min-w-[300px]">
        {/* 1. POR ASIGNAR */}
        <div
          className="flex flex-col bg-gray-100/50 rounded-xl border border-gray-200 min-h-[500px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "PENDIENTE")}
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              Por Asignar
            </h2>
            <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-extrabold">
              {pendingTickets.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1">
            {pendingTickets.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm opacity-60">
                <CheckCircle className="w-8 h-8 mb-2" />
                <p>Bandeja limpia</p>
              </div>
            )}
            {pendingTickets.map((ticket) => (
              <div
                key={ticket.id}
                draggable
                onDragStart={(e) => handleDragStart(e, ticket.id)}
                className={`bg-white p-4 rounded-xl shadow-md border border-gray-200 ${getPriorityColor(
                  ticket,
                )} ${
                  ticket.is_vip_ticket
                    ? "ring-2 ring-yellow-400 bg-yellow-50/20 shadow-yellow-100"
                    : ""
                } hover:shadow-lg transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2 cursor-grab active:cursor-grabbing`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  setSelectedTicket(ticket);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1 items-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                          ticket.ticket_type === "INC"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {ticket.ticket_type === "INC" ? (
                          <Zap className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {ticket.ticket_code || `#${ticket.id}`}
                      </span>
                      {ticket.is_vip_ticket && (
                        <span
                          className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-200"
                          title="Usuario VIP"
                        >
                          <Crown className="w-3 h-3" /> VIP
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {ticket.category}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {ticket.ticket_type === "INC" &&
                      ticket.sla_status === "running" && (
                        <CountdownTimer
                          targetDate={ticket.sla_expected_end_at || undefined}
                        />
                      )}
                    <div
                      className="flex items-center gap-1 text-[10px] text-gray-400"
                      title={`Actualizado: ${new Date(
                        ticket.updated_at || ticket.created_at || "",
                      ).toLocaleString()}`}
                    >
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(
                        ticket.updated_at || ticket.created_at || undefined,
                      )}
                    </div>
                  </div>
                </div>
                <h3 className="font-bold text-gray-800 text-base mb-1">
                  {ticket.users?.full_name || "Usuario desconocido"}
                </h3>
                <div className="text-sm text-gray-500 mb-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium text-gray-600">
                      {ticket.location}
                    </span>
                  </div>
                  {ticket.assets && (
                    <button
                      onClick={() =>
                        setSelectedAssetSerial(ticket.assets!.serial_number)
                      }
                      className="bg-gray-50 p-1.5 rounded text-xs text-gray-500 flex items-center gap-2 border border-gray-100 w-fit hover:bg-gray-100 hover:text-sena-blue transition-colors mt-1"
                      title="Ver historial de este equipo"
                    >
                      <Monitor className="w-3 h-3" />
                      {ticket.assets.type} {ticket.assets.model}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onUpdateStatus(ticket.id, "EN_PROGRESO")}
                  className="w-full bg-sena-blue hover:bg-blue-800 text-white text-sm py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  Atender Caso
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. EN CURSO */}
        <div
          className="flex flex-col bg-blue-50/30 rounded-xl border border-blue-100 min-h-[500px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "EN_PROGRESO")}
        >
          <div className="p-4 border-b border-blue-100 bg-blue-50/50 rounded-t-xl flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
              En Curso
            </h2>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-extrabold">
              {inProgressTickets.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1">
            {inProgressTickets.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm opacity-60">
                <PlayCircle className="w-8 h-8 mb-2" />
                <p>Sin tickets activos</p>
              </div>
            )}
            {inProgressTickets.map((ticket) => (
              <div
                key={ticket.id}
                draggable
                onDragStart={(e) => handleDragStart(e, ticket.id)}
                className={`bg-white p-4 rounded-xl shadow-md border border-gray-200 ${getPriorityColor(
                  ticket,
                )} ${
                  ticket.is_vip_ticket
                    ? "ring-2 ring-yellow-400 bg-yellow-50/20 shadow-yellow-100"
                    : ""
                } hover:shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-left-2 cursor-grab active:cursor-grabbing`}
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest("button") ||
                    (e.target as HTMLElement).closest("select") ||
                    (e.target as HTMLElement).closest("textarea")
                  )
                    return;
                  setSelectedTicket(ticket);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1 max-w-[70%]">
                    <div className="flex gap-1 items-center flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                          ticket.ticket_type === "INC"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {ticket.ticket_type === "INC" ? (
                          <Zap className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {ticket.ticket_code || `#${ticket.id}`}
                      </span>
                      {ticket.is_vip_ticket && (
                        <span
                          className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-200"
                          title="Usuario VIP"
                        >
                          <Crown className="w-3 h-3" /> VIP
                        </span>
                      )}
                      {/* MÍO Badge Logic */}
                      {(() => {
                        const userStr = safeGetItem("tic_user");
                        if (userStr) {
                          const user = JSON.parse(userStr);
                          if (ticket.assigned_agent_id === user.id) {
                            return (
                              <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm">
                                MÍO
                              </span>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>

                    {/* SELECTOR DE CATEGORÍA */}
                    <select
                      className="text-[10px] border border-blue-200 rounded px-1 py-0.5 bg-white text-gray-600 outline-none cursor-pointer hover:border-blue-400 w-fit mt-1 shadow-sm"
                      value={ticket.category || "OTROS"}
                      onChange={(e) =>
                        onCategoryChange(ticket.id, e.target.value)
                      }
                    >
                      <option value="HARDWARE">HARDWARE</option>
                      <option value="SOFTWARE">SOFTWARE</option>
                      <option value="REDES">REDES</option>
                      <option value="OTROS">OTROS</option>
                    </select>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {ticket.ticket_type === "INC" &&
                      ticket.sla_status === "running" && (
                        <CountdownTimer
                          targetDate={ticket.sla_expected_end_at || undefined}
                        />
                      )}
                    <div
                      className="flex items-center gap-1 text-[10px] text-gray-400"
                      title={`Actualizado: ${new Date(
                        ticket.updated_at || ticket.created_at || "",
                      ).toLocaleString()}`}
                    >
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(
                        ticket.updated_at || ticket.created_at || undefined,
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-gray-800 mb-1">
                  {ticket.users?.full_name}
                </h3>
                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {ticket.location}
                </p>
                {ticket.assets && (
                  <button
                    onClick={() =>
                      setSelectedAssetSerial(ticket.assets!.serial_number)
                    }
                    className="text-xs text-blue-600 hover:underline mb-3 flex items-center gap-1"
                  >
                    <Monitor className="w-3 h-3" /> Ver Historial Equipo
                  </button>
                )}

                <div className="space-y-2">
                  {/* REASIGNAR AGENTE */}
                  <div className="mb-2">
                    <select
                      className="w-full text-xs border border-gray-200 rounded-lg p-1.5 bg-gray-50 text-gray-600 focus:ring-2 focus:ring-blue-100 outline-none"
                      value={ticket.assigned_agent_id || ""}
                      onChange={(e) => onReassign(ticket.id, e.target.value)}
                    >
                      <option value="" disabled>
                        Reasignar a...
                      </option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setResolvingTicketId(ticket.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    title="Resolver Ticket"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resolver Caso
                  </button>

                  {/* BOTÓN PARA CONGELAR/PAUSAR */}
                  <button
                    onClick={() => onToggleHold(ticket)}
                    className="w-full border border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 text-xs py-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    Esperar Repuesto (Pausar)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. RESUELTOS */}
        <div
          className="flex flex-col bg-green-50/30 rounded-xl border border-green-100 min-h-[500px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "RESUELTO")}
        >
          <div className="p-4 border-b border-green-100 bg-green-50/50 rounded-t-xl flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              Resueltos
              <button
                onClick={() => setIsResolvedCollapsed(!isResolvedCollapsed)}
                className="ml-2 text-xs text-green-600 hover:text-green-800 underline"
              >
                {isResolvedCollapsed ? "Mostrar" : "Ocultar"}
              </button>
            </h2>
            <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-extrabold">
              {resolvedTickets.length}
            </span>
          </div>

          {!isResolvedCollapsed && (
            <div className="p-3 space-y-3 flex-1">
              {resolvedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`bg-white p-4 rounded-xl shadow-sm border ${getPriorityColor(
                    ticket,
                  )} opacity-75 hover:opacity-100 transition-all duration-200 hover:shadow-sm cursor-pointer`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    setSelectedTicket(ticket);
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1 items-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                            ticket.ticket_type === "INC"
                              ? "bg-red-50 text-red-600"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {ticket.ticket_type === "INC" ? (
                            <Zap className="w-3 h-3" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          {ticket.ticket_code || `#${ticket.id}`}
                        </span>
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">
                          RESUELTO
                        </span>
                        {ticket.is_vip_ticket && (
                          <span
                            className="bg-yellow-50 text-yellow-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-100"
                            title="Usuario VIP"
                          >
                            <Crown className="w-3 h-3" /> VIP
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {ticket.category}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-1 text-[10px] text-gray-400"
                      title={`Actualizado: ${new Date(
                        ticket.updated_at || ticket.created_at || "",
                      ).toLocaleString()}`}
                    >
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(
                        ticket.updated_at || ticket.created_at || undefined,
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm text-gray-500">
                    {ticket.users?.full_name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 italic">
                    Ticket cerrado
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
