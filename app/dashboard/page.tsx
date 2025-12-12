"use client";

import AssetHistoryModal from "@/components/features/assets/AssetHistoryModal";
import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { safeGetItem, safeRemoveItem } from "@/lib/storage";
import {
  LayoutDashboard,
  RefreshCw,
  Clock,
  CheckCircle,
  MapPin,
  Monitor,
  Power,
  PlayCircle,
  PauseCircle, // Icono para pausar el SLA
  Snowflake, // Icono del congelador
  LogOut,
  BarChart2,
  Shield,
  Zap, // For INC
  FileText, // For REQ
  Crown, // For VIP
  History, // Added for History Tab
} from "lucide-react";
import TicketHistory from "@/components/features/tickets/TicketHistory";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TicketDetailsModal from "@/components/features/tickets/TicketDetailsModal";
import NotificationManager from "@/components/NotificationManager";
import UserProfileModal from "@/components/UserProfileModal";

// --- DEFINICIÓN DE TIPOS (Incluyendo campos SLA) ---
import { Ticket } from "@/app/admin/types";

import { useUserProfile } from "@/hooks/useUserProfile";

// --- HELPERS VISUALES ---
const getPriorityColor = (ticket: Ticket) => {
  if (ticket.ticket_type === "INC") return "border-l-4 border-l-red-500";
  if (ticket.ticket_type === "REQ") return "border-l-4 border-l-blue-500";
  return "border-l-4 border-l-gray-300";
};

const CountdownTimer = ({ targetDate }: { targetDate?: string }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isBreached, setIsBreached] = useState(false);

  useEffect(() => {
    if (!targetDate) return;

    const calculate = () => {
      const now = new Date().getTime();
      const end = new Date(targetDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsBreached(true);
        setTimeLeft("00h 00m");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    calculate();
    const interval = setInterval(calculate, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  return (
    <span
      className={`text-xs font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
        isBreached
          ? "bg-red-600 text-white animate-pulse"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      <Clock className="w-3 h-3" />
      {isBreached ? "VENCIDO" : timeLeft}
    </span>
  );
};

export default function AgentDashboard() {
  const router = useRouter();
  const { user: currentUser } = useUserProfile();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<
    { id: string; full_name: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  // Estado para colapsar/expandir la sección del "Congelador"
  const [showFreezer, setShowFreezer] = useState(false);
  // Estado para el modal de historial de activos
  const [selectedAssetSerial, setSelectedAssetSerial] = useState<string | null>(
    null
  );
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [isResolvedCollapsed, setIsResolvedCollapsed] = useState(false);
  const [solutionTexts, setSolutionTexts] = useState<Record<number, string>>(
    {}
  );

  // Estados para filtros de métricas
  const [metricsStartDate, setMetricsStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [metricsEndDate, setMetricsEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // VISTA DEL DASHBOARD
  const [viewMode, setViewMode] = useState<"KANBAN" | "HISTORY">("KANBAN");

  // --- 1. CARGA DE DATOS ---
  const fetchTickets = async () => {
    try {
      // Consultamos tickets con sus relaciones (Usuario y Activo)
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
        *,
        users:users!tickets_user_id_fkey ( full_name, area ),
        assigned_agent:users!tickets_assigned_agent_id_fkey ( full_name ),
        assets ( model, type, serial_number )
      `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error cargando tickets:", error);
        throw error;
      }

      setTickets(data as Ticket[]);

      // Cargar Agentes para reasignación
      const { data: agentsData } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("role", ["agent", "admin"]);

      if (agentsData) {
        setAgents(agentsData);
      }

      setLoading(false);
    } catch (error) {
      console.error("❌ Error en fetchTickets:", error);
      setLoading(false);
    }
  };

  const handleReassign = async (ticketId: number, newAgentId: string) => {
    if (!newAgentId) return;
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_agent_id: newAgentId })
      .eq("id", ticketId);

    if (error) {
      console.error("Error reasignando ticket:", error);
      alert(
        `Error reasignando ticket: ${
          error.message || error.details || JSON.stringify(error)
        }`
      );
    } else {
      alert("Ticket reasignado correctamente");
      fetchTickets(); // Recargar datos manualmente
    }
  };

  // --- 2. TIEMPO REAL (Supabase Realtime) ---
  useEffect(() => {
    const loadData = async () => {
      await fetchTickets(); // Carga inicial
    };
    if (currentUser) void loadData();

    // Suscripción a cambios en la base de datos
    const channel = supabase
      .channel("realtime tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          void fetchTickets(); // Recargar si algo cambia
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // --- 2.1 GESTIÓN DE SESIÓN Y ESTADO ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    safeRemoveItem("tic_user");
    router.push("/login");
  };

  const toggleAvailability = async () => {
    const newStatus = !isAvailable;
    setIsAvailable(newStatus); // Optimistic update

    try {
      const userStr = safeGetItem("tic_user");
      if (!userStr) return;
      const user = JSON.parse(userStr);

      const { error } = await supabase
        .from("users")
        .update({ status: newStatus ? "available" : "busy" })
        .eq("id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error actualizando estado:", error);
      setIsAvailable(!newStatus); // Revertir
      alert("No se pudo actualizar tu estado. Revisa tu conexión o permisos.");
    }
  };

  // --- 3. LÓGICA CORE DEL SLA (PAUSAR / REANUDAR) ---
  const toggleHold = async (ticket: Ticket) => {
    const isHolding = ticket.status === "EN_ESPERA";

    // Determinamos el nuevo estado
    const newStatus = isHolding ? "EN_PROGRESO" : "EN_ESPERA";

    const updates: Partial<Ticket> = { status: newStatus };

    if (!isHolding) {
      // >>> CONGELAR <<<
      const reason = prompt(
        "Ingrese el motivo de pausa (Ej: Espera Repuesto, Espera Usuario, etc):"
      );
      if (!reason) return; // Cancelar si no escribe motivo

      // Guardamos la fecha actual para detener el reloj de métricas
      updates.sla_clock_stopped_at = new Date().toISOString();
      updates.hold_reason = reason;
      updates.sla_pause_reason = reason; // Asegurar compatibilidad
      updates.sla_status = "paused";

      // Lógica de movimiento a Freezer
      if (/repuesto|garant|proveedor|compra/i.test(reason)) {
        updates.status = "EN_ESPERA";
      } else {
        updates.status = "EN_PROGRESO";
      }
    } else {
      // >>> REANUDAR <<<
      // Limpiamos la fecha de parada para que el reloj "siga corriendo"
      updates.sla_clock_stopped_at = null;
      updates.hold_reason = null;
      updates.sla_pause_reason = null;
      updates.sla_status = "running";
    }

    // Actualizamos en Base de Datos
    const { error } = await supabase
      .from("tickets")
      .update(updates)
      .eq("id", ticket.id);

    if (error) {
      console.error("Error SLA:", error);
      alert(
        `Error al actualizar SLA: ${
          error.message || error.details || JSON.stringify(error)
        }`
      );
    } else {
      fetchTickets(); // Recargar datos manualmente
    }
  };

  // --- 3.1 CAMBIAR CATEGORÍA ---
  const handleCategoryChange = async (
    ticketId: number,
    newCategory: string
  ) => {
    const { error } = await supabase
      .from("tickets")
      .update({ category: newCategory })
      .eq("id", ticketId);

    if (error) {
      alert("Error actualizando categoría");
    } else {
      fetchTickets();
    }
  };

  // --- 3.2 AGREGAR COMENTARIO (SEGUIMIENTO) ---
  // --- 3.2 AGREGAR COMENTARIO (SEGUIMIENTO) ---
  // Versión INTERACTIVA (para el Dashboard/Cards) - Pide prompt
  const promptAddComment = async (
    ticketId: number,
    currentDescription: string
  ) => {
    const comment = prompt("Ingrese su comentario de seguimiento:");
    if (!comment) return;

    await saveTicketComment(ticketId, comment, currentDescription);
  };

  // Versión DIRECTA (para el Modal) - Recibe el texto ya escrito
  const saveTicketComment = async (
    ticketId: number,
    newComment: string,
    currentDescription?: string // Opcional, si no se pasa se busca (o se concatena en DB si fuera posible, aqui concatenamos en JS)
  ) => {
    if (!newComment) return;

    let finalDesc = currentDescription || "";

    // Si no tenemos la description actual, tendríamos que buscarla
    // Pero en el dashboard 'tickets' tiene la data.
    if (!finalDesc) {
      const t = tickets.find((ticket) => ticket.id === ticketId);
      if (t) finalDesc = t.description || "";
    }

    const dateStr = new Date().toLocaleString();
    const newDescription =
      (finalDesc || "") + `\n\n[${dateStr}] SEGUIMIENTO: ${newComment}`;

    const { error } = await supabase
      .from("tickets")
      .update({ description: newDescription })
      .eq("id", ticketId);

    if (error) {
      alert("Error al guardar comentario");
    } else {
      alert("Comentario agregado correctamente");
      fetchTickets();
    }
  };

  // --- 4. ACTUALIZAR ESTADO SIMPLE Y ATRIBUCIÓN ---
  const updateStatus = async (ticketId: number, newStatus: string) => {
    const updates: Partial<Ticket> = { status: newStatus };

    try {
      const userStr = safeGetItem("tic_user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (newStatus === "EN_PROGRESO") {
        // Asignar al usuario actual al tomar el caso
        if (user && user.id) {
          updates.assigned_agent_id = user.id;
        }
      } else if (newStatus === "PENDIENTE") {
        // Desasignar al soltar el caso
        updates.assigned_agent_id = null;
      } else if (newStatus === "RESUELTO") {
        // Asignar al usuario actual si cierra el caso ("El que cierra gana")
        if (user && user.id) {
          updates.assigned_agent_id = user.id;
        }
        // Guardar la solución si existe
        if (solutionTexts[ticketId]) {
          updates.solution = solutionTexts[ticketId];

          // Buscar el ticket actual para obtener descripción previa
          const currentTicket = tickets.find((t) => t.id === ticketId);
          if (currentTicket) {
            const dateStr = new Date().toLocaleString();
            updates.description =
              (currentTicket.description || "") +
              `\n\n[${dateStr}] SOLUCIÓN: ${solutionTexts[ticketId]}`;
          }
        }
      }
    } catch (e) {
      console.warn("Error gestionando asignación de usuario:", e);
    }

    // Usamos .select() para verificar si realmente se actualizó (RLS)
    const { data, error } = await supabase
      .from("tickets")
      .update(updates)
      .eq("id", ticketId)
      .select();

    // Siempre recargar para asegurar consistencia
    await fetchTickets();

    if (error) {
      console.error("Error actualizando ticket:", error);
      alert(
        `Error actualizando ticket: ${
          error.message || error.details || JSON.stringify(error)
        }`
      );
    } else if (!data || data.length === 0) {
      // Si no hay error pero no devolvió datos, es probable que RLS lo haya bloqueado silenciosamente
      console.error("Actualización ignorada por RLS (sin permisos)");
      alert(
        "⚠️ No se pudo actualizar el estado. Es posible que no tengas permisos para modificar este ticket o que ya haya sido modificado."
      );
    } else {
      // Éxito
      const statusMessages: Record<string, string> = {
        EN_PROGRESO: "Caso atendido correctamente",
        RESUELTO: "Caso resuelto correctamente",
        EN_ESPERA: "Caso pausado correctamente",
        PENDIENTE: "Caso devuelto a pendientes",
      };
      // Solo mostramos alert si NO es un drag & drop (opcional, pero por ahora lo dejamos para feedback)
      // Podríamos usar un toast en el futuro
      alert(statusMessages[newStatus] || "Ticket actualizado");
    }
  };

  // --- 5. DRAG AND DROP HANDLERS ---
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    ticketId: number
  ) => {
    e.dataTransfer.setData("ticketId", ticketId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necesario para permitir el drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    newStatus: string
  ) => {
    e.preventDefault();
    const ticketIdStr = e.dataTransfer.getData("ticketId");
    if (!ticketIdStr) return;

    const ticketId = parseInt(ticketIdStr, 10);
    if (isNaN(ticketId)) return;

    // Evitar actualización si soltamos en la misma columna (opcional, pero buena práctica)
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket && ticket.status === newStatus) return;

    updateStatus(ticketId, newStatus);
  };

  // --- 5. FILTROS Y ORDENAMIENTO VISUAL ---
  // Helper para ordenar: INC primero, luego por SLA (time left)
  const sortTickets = (ticketList: Ticket[]) => {
    return [...ticketList].sort((a, b) => {
      // 1. Prioridad Tipo: INC > REQ
      if (a.ticket_type === "INC" && b.ticket_type !== "INC") return -1;
      if (a.ticket_type !== "INC" && b.ticket_type === "INC") return 1;

      // 2. Prioridad Urgencia: Menor fecha fin = Más urgente
      const dateA = a.sla_expected_end_at || a.created_at;
      const dateB = b.sla_expected_end_at || b.created_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  };

  // Aplicamos el sort a las listas filtradas
  const pendingTickets = sortTickets(
    tickets.filter((t) => t.status === "PENDIENTE")
  );
  const inProgressTickets = sortTickets(
    tickets.filter((t) => t.status === "EN_PROGRESO")
  );
  const waitingTickets = tickets.filter(
    (t) => t.status === "EN_ESPERA" || t.status === "WAITING_PARTS"
  );
  // Nota: waitingTickets usualmente no requiere sort estricto visual, pero si se quiere:
  // const waitingTickets = sortTickets(tickets.filter((t) => t.status === "EN_ESPERA"));

  const resolvedTickets = tickets.filter((t) => {
    const isResolved = t.status === "RESUELTO" || t.status === "CERRADO";
    if (!isResolved) return false;
    const dateToCheck = new Date(t.updated_at || t.created_at);
    const diffTime = Math.abs(new Date().getTime() - dateToCheck.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 12;
  });

  // ... (rest of filtering logic for reports)

  // ... (rest of filtering logic for reports)

  const downloadReport = () => {
    if (!currentUser) return;

    const filteredTickets = tickets.filter((t) => {
      const isResolved = t.status === "RESUELTO" || t.status === "CERRADO";
      const isMine =
        t.assigned_agent_id === currentUser.id ||
        (t.assigned_agent &&
          t.assigned_agent.full_name === currentUser.full_name);

      const ticketDate = new Date(t.created_at);
      const start = new Date(metricsStartDate);
      const end = new Date(metricsEndDate);
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
        new Date(t.created_at).toLocaleDateString(),
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
      `reporte_agente_${metricsStartDate}_${metricsEndDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 6. HELPER FECHAS ---
  const getTimeAgo = (dateString?: string) => {
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

  return (
    <AuthGuard allowedRoles={["agent", "admin", "superadmin"]}>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <NotificationManager tickets={tickets} />
        {/* MODAL DE HISTORIAL DE ACTIVO */}
        {selectedAssetSerial && (
          <AssetHistoryModal
            serialNumber={selectedAssetSerial}
            onClose={() => setSelectedAssetSerial(null)}
          />
        )}

        {/* MODAL DE PERFIL DE USUARIO */}
        {showProfileModal && currentUser && (
          <UserProfileModal
            user={currentUser}
            onClose={() => setShowProfileModal(false)}
          />
        )}

        {/* MODAL DE DETALLES DEL TICKET (TRAZABILIDAD) */}
        {selectedTicket && (
          <TicketDetailsModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            currentUser={currentUser || undefined}
            onUpdateStatus={updateStatus}
            onAssign={(tId) => updateStatus(tId, "EN_PROGRESO")}
            onAddComment={saveTicketComment}
            agents={agents}
          />
        )}

        {/* MODAL DE MÉTRICAS PERSONALES */}
        {showMetricsModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-sena-blue" />
                  Mis Métricas (Mes Actual)
                </h3>
                <button
                  onClick={() => setShowMetricsModal(false)}
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
                        // Si assigned_agent_id es string y user.id es number, ojo. Supabase devuelve string uuid usualmente.
                        const isMine =
                          t.assigned_agent_id === currentUser.id ||
                          (t.assigned_agent &&
                            t.assigned_agent.full_name ===
                              currentUser.full_name);

                        const ticketDate = new Date(t.created_at);
                        const start = new Date(metricsStartDate);
                        const end = new Date(metricsEndDate);
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
                    tickets.reduce((acc, ticket) => {
                      if (!ticket.assets) return acc;
                      const key = `${ticket.assets.type} ${ticket.assets.model} (${ticket.assets.serial_number})`;
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
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
        )}

        {/* NAVBAR */}
        <header className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-sena-green p-2 rounded-lg shadow-sm">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <h1 className="font-bold text-sena-blue text-xl tracking-tight hidden sm:block">
              Mesa de Ayuda <span className="text-sena-green">TIC</span>
              {currentUser && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  | {currentUser.full_name}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {(currentUser?.role === "admin" ||
              currentUser?.role === "superadmin") && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all border cursor-pointer bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 shadow-sm"
                title="Volver al Panel Admin"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin Panel</span>
              </Link>
            )}
            <button
              onClick={toggleAvailability}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all border cursor-pointer ${
                isAvailable
                  ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200 shadow-sm"
                  : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
              }`}
              title="Cambiar estado de disponibilidad"
            >
              <Power className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isAvailable ? "DISPONIBLE" : "NO DISPONIBLE"}
              </span>
            </button>

            <button
              onClick={() => setShowProfileModal(true)}
              className="h-9 w-9 rounded-full bg-sena-blue flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white ring-2 ring-gray-100 hover:ring-sena-green transition-all cursor-pointer"
              title="Tu Perfil"
            >
              {currentUser?.full_name
                ? currentUser.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "AG"}
            </button>

            <button
              onClick={() => setShowMetricsModal(true)}
              className="p-2 text-gray-400 hover:text-sena-blue hover:bg-blue-50 rounded-full transition-colors"
              title="Ver Mis Métricas"
            >
              <BarChart2 className="w-5 h-5" />
            </button>

            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* CONTENIDO */}
        <main className="flex-1 p-6 overflow-x-auto">
          {/* BARRA DE CONTROL Y PESTAÑAS */}
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
                    waitingTickets.length > 0
                      ? "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Snowflake
                    className={`w-4 h-4 ${
                      waitingTickets.length > 0 ? "animate-pulse" : ""
                    }`}
                  />
                  Rep. y Garantías ({waitingTickets.length})
                </button>
              )}

              <button
                onClick={() => {
                  setLoading(true);
                  fetchTickets();
                }}
                className="flex items-center gap-2 text-gray-500 hover:text-sena-blue text-sm font-medium cursor-pointer transition-colors bg-white px-3 py-2 rounded-lg border border-gray-200 hover:border-sena-blue shadow-sm"
                title="Recargar datos"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* --- VISTA: HISTORIAL --- */}
          {viewMode === "HISTORY" ? (
            <TicketHistory />
          ) : (
            // --- VISTA: KANBAN ---
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
                          if ((e.target as HTMLElement).closest("button"))
                            return;
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
                              ticket.updated_at || ticket.created_at
                            ).toLocaleString()}`}
                          >
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(ticket.updated_at || ticket.created_at)}
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
                            promptAddComment(
                              ticket.id,
                              ticket.description || ""
                            )
                          }
                          className="w-full mb-2 bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <span className="text-[10px]">💬</span> Agregar
                          Seguimiento
                        </button>

                        {/* Botón para REANUDAR */}
                        <button
                          onClick={() => toggleHold(ticket)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Reanudar SLA
                        </button>
                      </div>
                    ))}

                    {waitingTickets.length === 0 && (
                      <p className="text-sm text-purple-400 italic py-4 col-span-full text-center">
                        No hay equipos para repuestos ni garantias... ¡Buen
                        trabajo! 👌👍
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
                          ticket
                        )} ${
                          ticket.is_vip_ticket
                            ? "ring-2 ring-yellow-400 bg-yellow-50/20 shadow-yellow-100"
                            : ""
                        } hover:shadow-lg transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2 cursor-grab active:cursor-grabbing`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button"))
                            return;
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
                                  targetDate={ticket.sla_expected_end_at}
                                />
                              )}
                            <div
                              className="flex items-center gap-1 text-[10px] text-gray-400"
                              title={`Actualizado: ${new Date(
                                ticket.updated_at || ticket.created_at
                              ).toLocaleString()}`}
                            >
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(
                                ticket.updated_at || ticket.created_at
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
                                setSelectedAssetSerial(
                                  ticket.assets!.serial_number
                                )
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
                          onClick={() => updateStatus(ticket.id, "EN_PROGRESO")}
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
                          ticket
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
                              value={ticket.category}
                              onChange={(e) =>
                                handleCategoryChange(ticket.id, e.target.value)
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
                                  targetDate={ticket.sla_expected_end_at}
                                />
                              )}
                            <div
                              className="flex items-center gap-1 text-[10px] text-gray-400"
                              title={`Actualizado: ${new Date(
                                ticket.updated_at || ticket.created_at
                              ).toLocaleString()}`}
                            >
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(
                                ticket.updated_at || ticket.created_at
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
                              setSelectedAssetSerial(
                                ticket.assets!.serial_number
                              )
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
                              onChange={(e) =>
                                handleReassign(ticket.id, e.target.value)
                              }
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

                          {/* CAMPO DE SOLUCIÓN */}
                          <textarea
                            className="w-full text-xs border border-gray-300 rounded-lg p-2 mb-2 h-20 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                            placeholder="Detalle la solución (mínimo 20 palabras)..."
                            value={solutionTexts[ticket.id] || ""}
                            onChange={(e) =>
                              setSolutionTexts({
                                ...solutionTexts,
                                [ticket.id]: e.target.value,
                              })
                            }
                          />

                          <button
                            onClick={() => updateStatus(ticket.id, "RESUELTO")}
                            disabled={
                              !solutionTexts[ticket.id] ||
                              solutionTexts[ticket.id].trim().split(/\s+/)
                                .length < 20
                            }
                            className={`w-full text-white text-xs py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center justify-center gap-2 ${
                              !solutionTexts[ticket.id] ||
                              solutionTexts[ticket.id].trim().split(/\s+/)
                                .length < 20
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-700 cursor-pointer"
                            }`}
                            title={
                              !solutionTexts[ticket.id] ||
                              solutionTexts[ticket.id].trim().split(/\s+/)
                                .length < 20
                                ? "Escriba al menos 20 palabras para resolver"
                                : "Resolver Ticket"
                            }
                          >
                            Resolver{" "}
                            {(!solutionTexts[ticket.id] ||
                              solutionTexts[ticket.id].trim().split(/\s+/)
                                .length < 20) &&
                              `(${
                                solutionTexts[ticket.id]
                                  ? solutionTexts[ticket.id].trim().split(/\s+/)
                                      .length
                                  : 0
                              }/20)`}
                          </button>

                          {/* BOTÓN PARA CONGELAR/PAUSAR */}
                          <button
                            onClick={() => toggleHold(ticket)}
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
                        onClick={() =>
                          setIsResolvedCollapsed(!isResolvedCollapsed)
                        }
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
                            ticket
                          )} opacity-75 hover:opacity-100 transition-all duration-200 hover:shadow-sm cursor-pointer`}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("button"))
                              return;
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
                                ticket.updated_at || ticket.created_at
                              ).toLocaleString()}`}
                            >
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(
                                ticket.updated_at || ticket.created_at
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
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
