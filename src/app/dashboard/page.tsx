"use client";

import AssetHistoryModal from "@/features/assets/components/AssetHistoryModal";
import AuthGuard from "@/components/AuthGuard";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { safeGetItem, safeRemoveItem } from "@/lib/storage";
import {
  LayoutDashboard,
  RefreshCw,
  CheckCircle,
  Power,
  Snowflake, // Icono del congelador
  LogOut,
  BarChart2,
  Shield,
  History, // Added for History Tab
  CalendarRange, // For Environments Tab
  BookOpen, // For Knowledge Base
  ArrowLeft,
} from "lucide-react";
import TicketHistory from "@/features/tickets/components/TicketHistory";
import AssignmentManager from "@/features/assignments/components/AssignmentManager";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TicketDetailsModal from "@/features/tickets/components/TicketDetailsModal";
import NotificationManager from "@/components/NotificationManager";
import UserProfileModal from "@/components/shared/UserProfileModal";

// --- DEFINICIÓN DE TIPOS (Incluyendo campos SLA) ---
import { Ticket } from "@/app/admin/admin.types";

import { useUserProfile } from "@/features/auth/hooks/useUserProfile";
import { useTickets } from "@/features/tickets/hooks/useTickets";

import { useTicketActions } from "@/features/tickets/hooks/useTicketActions";
import { MetricsOverview } from "@/components/dashboard/MetricsOverview";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";

export default function AgentDashboard() {
  const router = useRouter();
  const { user: currentUser, role, permissions } = useUserProfile();

  // --- HOOKS ---
  const {
    tickets,
    agents,
    loading,
    refreshTickets: fetchTickets,
  } = useTickets(currentUser);
  const {
    handleReassign,
    toggleHold,
    handleCategoryChange,
    saveTicketComment,
    promptAddComment,
    updateStatus: updateStatusBase,
  } = useTicketActions(tickets, fetchTickets, currentUser);

  // Wrapper to preserve access to local solutionTexts state
  const updateStatus = async (ticketId: number, newStatus: string) => {
    await updateStatusBase(ticketId, newStatus, solutionTexts[ticketId]);
  };

  const [resolvingTicketId, setResolvingTicketId] = useState<number | null>(
    null,
  );
  // const [loading, setLoading] = useState(true); // Handled by hook
  const [isAvailable, setIsAvailable] = useState(true);

  // Estado para colapsar/expandir la sección del "Congelador"
  const [showFreezer, setShowFreezer] = useState(false);
  // Estado para el modal de historial de activos
  const [selectedAssetSerial, setSelectedAssetSerial] = useState<string | null>(
    null,
  );
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [solutionTexts, setSolutionTexts] = useState<Record<number, string>>(
    {},
  );

  // VISTA DEL DASHBOARD
  const [viewMode, setViewMode] = useState<
    "KANBAN" | "HISTORY" | "ENVIRONMENTS"
  >("KANBAN");

  // --- 1. CARGA DE DATOS ---

  // --- 2. TIEMPO REAL (Supabase Realtime) ---

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

  // --- 3.1 CAMBIAR CATEGORÍA ---

  // --- 3.2 AGREGAR COMENTARIO (SEGUIMIENTO) ---
  // --- 3.2 AGREGAR COMENTARIO (SEGUIMIENTO) ---
  // Versión INTERACTIVA (para el Dashboard/Cards) - Pide prompt

  // Versión DIRECTA (para el Modal) - Recibe el texto ya escrito

  // --- 4. ACTUALIZAR ESTADO SIMPLE Y ATRIBUCIÓN ---

  // --- 5. FILTROS Y ORDENAMIENTO VISUAL ---
  // Helper para ordenar: INC primero, luego por SLA (time left)
  const sortTickets = (ticketList: Ticket[]) => {
    return [...ticketList].sort((a, b) => {
      // 1. Prioridad Tipo: INC > REQ
      if (a.ticket_type === "INC" && b.ticket_type !== "INC") return -1;
      if (a.ticket_type !== "INC" && b.ticket_type === "INC") return 1;

      // 2. Prioridad Urgencia: Menor fecha fin = Más urgente
      const dateA = a.sla_expected_end_at || a.created_at;
      const dateB = b.sla_expected_end_at || b.created_at || "";
      return new Date(dateA || "").getTime() - new Date(dateB).getTime();
    });
  };

  // Aplicamos el sort a las listas filtradas
  const pendingTickets = sortTickets(
    tickets.filter((t) => t.status === "PENDIENTE"),
  );
  const inProgressTickets = sortTickets(
    tickets.filter((t) => t.status === "EN_PROGRESO"),
  );
  const waitingTickets = tickets.filter(
    (t) => t.status === "EN_ESPERA" || t.status === "WAITING_PARTS",
  );
  // Nota: waitingTickets usualmente no requiere sort estricto visual, pero si se quiere:
  // const waitingTickets = sortTickets(tickets.filter((t) => t.status === "EN_ESPERA"));

  const resolvedTickets = tickets.filter((t) => {
    const isResolved = t.status === "RESUELTO" || t.status === "CERRADO";
    if (!isResolved) return false;
    const dateToCheck = new Date(t.updated_at || t.created_at || "");
    const diffTime = Math.abs(new Date().getTime() - dateToCheck.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 12;
  });

  // ... (rest of filtering logic for reports)

  // ... (rest of filtering logic for reports)

  // --- 6. HELPER FECHAS ---

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
            user={{
              id: currentUser.id,
              full_name: currentUser.user_metadata?.full_name || "Usuario",
              username: currentUser.user_metadata?.username || "user",
              email: currentUser.email || null,
              role: role || "agent",
              area: currentUser.user_metadata?.area || null,
              created_at: currentUser.created_at,
              is_active: true,
              is_vip: !!currentUser.user_metadata?.is_vip,
              employment_type: currentUser.user_metadata?.employment_type,
              job_category: currentUser.user_metadata?.job_category,
              perm_create_assets:
                !!currentUser.user_metadata?.perm_create_assets,
              perm_transfer_assets:
                !!currentUser.user_metadata?.perm_transfer_assets,
              perm_decommission_assets:
                !!currentUser.user_metadata?.perm_decommission_assets,
              perm_manage_assignments:
                !!currentUser.user_metadata?.perm_manage_assignments,
            }}
            onClose={() => setShowProfileModal(false)}
          />
        )}

        {/* MODAL DE DETALLES DEL TICKET (TRAZABILIDAD) */}
        {selectedTicket && (
          <TicketDetailsModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            currentUser={
              currentUser
                ? {
                    id: currentUser.id,
                    full_name:
                      currentUser.user_metadata?.full_name || "Usuario",
                  }
                : undefined
            }
            onUpdateStatus={updateStatus}
            onAssign={(tId) => updateStatus(tId, "EN_PROGRESO")}
            onAddComment={saveTicketComment}
            agents={agents}
          />
        )}

        {/* MODAL DE MÉTRICAS PERSONALES */}
        <MetricsOverview
          isOpen={showMetricsModal}
          onClose={() => setShowMetricsModal(false)}
          tickets={tickets}
          currentUser={currentUser}
        />

        {/* NOTIFICACIONES SLA */}
        <NotificationManager tickets={tickets} />

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
                  | {currentUser.user_metadata?.full_name}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {(role === "admin" || role === "superadmin") && (
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

            {/* TAB: AMBIENTES (Visible si tiene permisos o si es admin, O todos pueden ver disponibilidad) */}
            {/* Decidimos que todos pueden ver "Disponibilidad", pero solo coord asigna. */}
            <button
              onClick={() => setViewMode("ENVIRONMENTS")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold transition-all ${
                viewMode === "ENVIRONMENTS"
                  ? "bg-purple-100 text-purple-700 shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <CalendarRange className="w-5 h-5" />
              <span className="hidden sm:inline">Ambientes</span>
            </button>
            <Link
              href="/dashboard/knowledge"
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-100"
              title="Ver Repositorio de Soporte"
            >
              <BookOpen className="w-5 h-5 text-sena-green" />
              <span className="hidden sm:inline">Repositorio</span>
            </Link>

            <button
              onClick={() => setShowProfileModal(true)}
              className="h-9 w-9 rounded-full bg-sena-blue flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white ring-2 ring-gray-100 hover:ring-sena-green transition-all cursor-pointer"
              title="Tu Perfil"
            >
              {currentUser?.user_metadata?.full_name
                ? ((currentUser.user_metadata?.full_name as string) || "")
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
          {/* --- VISTAS --- */}
          {viewMode === "ENVIRONMENTS" ? (
            <div className="animate-in fade-in zoom-in-95 duration-300 h-full pb-10">
              <AssignmentManager
                canManage={!!permissions?.manage_assignments}
              />
            </div>
          ) : viewMode === "HISTORY" ? (
            <TicketHistory />
          ) : (
            // --- VISTA: KANBAN ---
            <KanbanBoard
              tickets={tickets} // opcional, pero lo pasamos por si acaso
              pendingTickets={pendingTickets}
              inProgressTickets={inProgressTickets}
              resolvedTickets={resolvedTickets}
              waitingTickets={waitingTickets}
              agents={agents}
              currentUser={currentUser}
              onUpdateStatus={updateStatus}
              onReassign={handleReassign}
              onToggleHold={toggleHold}
              onPromptAddComment={promptAddComment}
              onCategoryChange={handleCategoryChange}
              setSelectedTicket={setSelectedTicket}
              setSelectedAssetSerial={setSelectedAssetSerial}
              setResolvingTicketId={setResolvingTicketId}
              showFreezer={showFreezer}
            />
          )}
        </main>

        {/* MODAL DE RESOLUCIÓN */}
        {resolvingTicketId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-green-600 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Resolver Ticket</h2>
                    <p className="text-xs text-green-100">
                      #{resolvingTicketId} - Detalla la solución definitiva
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setResolvingTicketId(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Power className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Importante:</strong> Debes detallar los pasos
                    técnicos realizados. Mínimo 20 palabras para asegurar la
                    calidad del repositorio.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">
                    Solución Técnica
                  </label>
                  <textarea
                    className="w-full border-2 border-gray-100 rounded-xl p-4 min-h-[180px] outline-none focus:border-green-500 transition-all resize-none text-gray-700 placeholder:text-gray-400"
                    placeholder="Describe qué hiciste para solucionar el problema..."
                    value={solutionTexts[resolvingTicketId] || ""}
                    onChange={(e) =>
                      setSolutionTexts({
                        ...solutionTexts,
                        [resolvingTicketId]: e.target.value,
                      })
                    }
                  />
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span
                      className={
                        (solutionTexts[resolvingTicketId]
                          ?.trim()
                          .split(/\s+/)
                          .filter(Boolean).length || 0) < 20
                          ? "text-red-500"
                          : "text-green-600"
                      }
                    >
                      Palabras:{" "}
                      {solutionTexts[resolvingTicketId]
                        ?.trim()
                        .split(/\s+/)
                        .filter(Boolean).length || 0}{" "}
                      / 20
                    </span>
                    <span className="text-gray-400 italic">
                      Auto-guardado habilitado
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setResolvingTicketId(null)}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a la bandeja
                  </button>
                  <button
                    disabled={
                      !solutionTexts[resolvingTicketId] ||
                      solutionTexts[resolvingTicketId]
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean).length < 20
                    }
                    onClick={async () => {
                      await updateStatus(resolvingTicketId, "RESUELTO");
                      setResolvingTicketId(null);
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                      !solutionTexts[resolvingTicketId] ||
                      solutionTexts[resolvingTicketId]
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean).length < 20
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 hover:scale-[1.02]"
                    }`}
                  >
                    Confirmar Solución
                    <CheckCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
