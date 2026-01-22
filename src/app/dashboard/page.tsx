"use client";

import AuthGuard from "@/components/AuthGuard";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { safeGetItem, safeRemoveItem } from "@/lib/storage";
import { useRouter } from "next/navigation";
import NotificationManager from "@/components/NotificationManager";

// --- HOOKS ---
import { useUserProfile } from "@/features/auth/hooks/useUserProfile";
import { useTickets } from "@/features/tickets/hooks/useTickets";
import { useTicketActions } from "@/features/tickets/hooks/useTicketActions";
import { Ticket } from "@/app/admin/admin.types";

// --- NEW COMPONENTS ---
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import DashboardTabs from "@/features/dashboard/components/DashboardTabs";
import DashboardContent from "@/features/dashboard/components/DashboardContent";
import DashboardModals from "@/features/dashboard/components/DashboardModals";
import ResolutionModal from "@/features/dashboard/components/ResolutionModal";

export default function AgentDashboard() {
  const router = useRouter();
  const { user: currentUser, role, permissions, profile } = useUserProfile();

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

  const [solutionTexts, setSolutionTexts] = useState<Record<number, string>>(
    {},
  );

  // Wrapper to preserve access to local solutionTexts state
  const updateStatus = async (ticketId: number, newStatus: string) => {
    await updateStatusBase(ticketId, newStatus, solutionTexts[ticketId]);
  };

  const [resolvingTicketId, setResolvingTicketId] = useState<number | null>(
    null,
  );
  const [isAvailable, setIsAvailable] = useState(true);

  // States
  const [showFreezer, setShowFreezer] = useState(false);
  const [selectedAssetSerial, setSelectedAssetSerial] = useState<string | null>(
    null,
  );
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);

  // VISTA DEL DASHBOARD
  const [viewMode, setViewMode] = useState<
    "KANBAN" | "HISTORY" | "ENVIRONMENTS"
  >("KANBAN");

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
        .eq("auth_id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error actualizando estado:", error);
      setIsAvailable(!newStatus); // Revertir
      alert("No se pudo actualizar tu estado. Revisa tu conexión o permisos.");
    }
  };

  // --- 5. FILTROS Y ORDENAMIENTO VISUAL ---
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

  const pendingTickets = sortTickets(
    tickets.filter((t) => t.status === "PENDIENTE"),
  );
  const inProgressTickets = sortTickets(
    tickets.filter((t) => t.status === "EN_PROGRESO"),
  );
  const waitingTickets = tickets.filter(
    (t) => t.status === "EN_ESPERA" || t.status === "WAITING_PARTS",
  );

  const resolvedTickets = tickets.filter((t) => {
    const isResolved = t.status === "RESUELTO" || t.status === "CERRADO";
    if (!isResolved) return false;
    const dateToCheck = new Date(t.updated_at || t.created_at || "");
    const diffTime = Math.abs(new Date().getTime() - dateToCheck.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 12;
  });

  return (
    <AuthGuard allowedRoles={["agent", "admin", "superadmin"]}>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <NotificationManager tickets={tickets} />

        <DashboardModals
          selectedAssetSerial={selectedAssetSerial}
          setSelectedAssetSerial={setSelectedAssetSerial}
          showProfileModal={showProfileModal}
          setShowProfileModal={setShowProfileModal}
          currentUser={currentUser}
          role={role}
          selectedTicket={selectedTicket}
          setSelectedTicket={setSelectedTicket}
          updateStatus={updateStatus}
          saveTicketComment={saveTicketComment}
          agents={agents}
          showCreateAssetModal={showCreateAssetModal}
          setShowCreateAssetModal={setShowCreateAssetModal}
          showMetricsModal={showMetricsModal}
          setShowMetricsModal={setShowMetricsModal}
          tickets={tickets}
          profile={profile}
        />

        <DashboardHeader
          currentUser={currentUser}
          profile={profile}
          role={role}
          isAvailable={isAvailable}
          toggleAvailability={toggleAvailability}
          setShowCreateAssetModal={setShowCreateAssetModal}
          handleLogout={handleLogout}
          viewMode={viewMode}
          setViewMode={setViewMode}
          setShowProfileModal={setShowProfileModal}
          setShowMetricsModal={setShowMetricsModal}
        />

        {/* CONTENIDO */}
        <main className="flex-1 p-6 overflow-x-auto">
          <DashboardTabs
            viewMode={viewMode}
            setViewMode={setViewMode}
            showFreezer={showFreezer}
            setShowFreezer={setShowFreezer}
            waitingTicketsCount={waitingTickets.length}
            loading={loading}
            fetchTickets={fetchTickets}
          />

          <DashboardContent
            viewMode={viewMode}
            permissions={permissions}
            currentUser={currentUser}
            role={role}
            profile={profile}
            tickets={tickets}
            pendingTickets={pendingTickets}
            inProgressTickets={inProgressTickets}
            resolvedTickets={resolvedTickets}
            waitingTickets={waitingTickets}
            agents={agents}
            updateStatus={updateStatus}
            handleReassign={handleReassign}
            toggleHold={toggleHold}
            promptAddComment={promptAddComment}
            handleCategoryChange={handleCategoryChange}
            setSelectedTicket={setSelectedTicket}
            setSelectedAssetSerial={setSelectedAssetSerial}
            setResolvingTicketId={setResolvingTicketId}
            showFreezer={showFreezer}
          />
        </main>

        <ResolutionModal
          resolvingTicketId={resolvingTicketId}
          onClose={() => setResolvingTicketId(null)}
          solutionTexts={solutionTexts}
          setSolutionTexts={setSolutionTexts}
          onUpdateStatus={updateStatus}
        />
      </div>
    </AuthGuard>
  );
}
