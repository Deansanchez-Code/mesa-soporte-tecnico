"use client";

import AssetHistoryModal from "@/features/assets/components/AssetHistoryModal";
import UserProfileModal from "@/components/shared/UserProfileModal";
import TicketDetailsModal from "@/features/tickets/components/TicketDetailsModal";
import CreateAssetModal from "@/features/assets/components/CreateAssetModal";
import { MetricsOverview } from "@/components/dashboard/MetricsOverview";
import { Ticket, Agent } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";

interface DashboardModalsProps {
  selectedAssetSerial: string | null;
  setSelectedAssetSerial: (serial: string | null) => void;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  currentUser: User | null;
  role: string | null;
  selectedTicket: Ticket | null;
  setSelectedTicket: (ticket: Ticket | null) => void;
  updateStatus: (ticketId: number, status: string) => Promise<void>;
  saveTicketComment: (ticketId: number, comment: string) => Promise<void>;
  agents: { id: string; full_name: string; role: string }[];
  showCreateAssetModal: boolean;
  setShowCreateAssetModal: (show: boolean) => void;
  showMetricsModal: boolean;
  setShowMetricsModal: (show: boolean) => void;
  tickets: Ticket[];
  profile: UserProfile["profile"];
}

export default function DashboardModals({
  selectedAssetSerial,
  setSelectedAssetSerial,
  showProfileModal,
  setShowProfileModal,
  currentUser,
  role,
  selectedTicket,
  setSelectedTicket,
  updateStatus,
  saveTicketComment,
  agents,
  showCreateAssetModal,
  setShowCreateAssetModal,
  showMetricsModal,
  setShowMetricsModal,
  tickets,
  profile,
}: DashboardModalsProps) {
  return (
    <>
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
            full_name:
              (profile?.full_name as string) ||
              currentUser.user_metadata?.full_name ||
              "Usuario",
            username: currentUser.user_metadata?.username || "user",
            email: currentUser.email || null,
            role: role || "agent",
            area: currentUser.user_metadata?.area || null,
            created_at: currentUser.created_at,
            is_active: true,
            is_vip: !!currentUser.user_metadata?.is_vip,
            employment_type: currentUser.user_metadata?.employment_type,
            job_category: currentUser.user_metadata?.job_category,
            perm_create_assets: !!currentUser.user_metadata?.perm_create_assets,
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
                  full_name: currentUser.user_metadata?.full_name || "Usuario",
                }
              : undefined
          }
          onUpdateStatus={updateStatus}
          onAssign={(tId) => updateStatus(tId, "EN_PROGRESO")}
          onAddComment={saveTicketComment}
          agents={
            role === "superadmin"
              ? agents
              : agents.filter((a) => a.role !== "superadmin")
          }
        />
      )}

      {/* MODAL DE CREACIÓN DE ACTIVOS (Para Agentes con Permiso) */}
      {showCreateAssetModal && currentUser && (
        <CreateAssetModal
          onClose={() => setShowCreateAssetModal(false)}
          onSuccess={() => {
            setShowCreateAssetModal(false);
            // Opcional: Refrescar listas si fuera necesario
          }}
          currentUserId={currentUser.id}
        />
      )}

      {/* MODAL DE MÉTRICAS PERSONALES */}
      <MetricsOverview
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        tickets={tickets}
        currentUser={currentUser}
      />
    </>
  );
}
