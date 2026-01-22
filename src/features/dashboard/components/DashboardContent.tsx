"use client";

import AssignmentManager from "@/features/assignments/components/AssignmentManager";
import TicketHistory from "@/features/tickets/components/TicketHistory";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { Ticket } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";

interface DashboardContentProps {
  viewMode: "KANBAN" | "HISTORY" | "ENVIRONMENTS";
  permissions: UserProfile["permissions"];
  currentUser: User | null;
  role: string | null;
  profile: UserProfile["profile"];
  tickets: Ticket[];
  pendingTickets: Ticket[];
  inProgressTickets: Ticket[];
  resolvedTickets: Ticket[];
  waitingTickets: Ticket[];
  agents: { id: string; full_name: string; role: string }[];
  updateStatus: (ticketId: number, status: string) => Promise<void>;
  handleReassign: (ticketId: number, agentId: string) => Promise<void>;
  toggleHold: (ticket: Ticket) => Promise<void>;
  promptAddComment: (
    ticketId: number,
    currentDescription: string,
  ) => Promise<void>;
  handleCategoryChange: (ticketId: number, category: string) => Promise<void>;
  setSelectedTicket: (ticket: Ticket | null) => void;
  setSelectedAssetSerial: (serial: string | null) => void;
  setResolvingTicketId: (ticketId: number | null) => void;
  showFreezer: boolean;
}

export default function DashboardContent({
  viewMode,
  permissions,
  currentUser,
  role,
  profile,
  tickets,
  pendingTickets,
  inProgressTickets,
  resolvedTickets,
  waitingTickets,
  agents,
  updateStatus,
  handleReassign,
  toggleHold,
  promptAddComment,
  handleCategoryChange,
  setSelectedTicket,
  setSelectedAssetSerial,
  setResolvingTicketId,
  showFreezer,
}: DashboardContentProps) {
  if (viewMode === "ENVIRONMENTS") {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-300 h-full pb-10">
        <AssignmentManager
          canManage={!!permissions?.manage_assignments}
          canDeleteAuditorium={
            !!profile?.is_vip ||
            ["superadmin", "admin", "vip"].includes(
              role?.toLowerCase() || "",
            ) ||
            ["superadmin", "admin", "vip"].includes(
              profile?.role?.toLowerCase() || "",
            )
          }
          user={profile}
        />
      </div>
    );
  }

  if (viewMode === "HISTORY") {
    return <TicketHistory />;
  }

  return (
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
  );
}
