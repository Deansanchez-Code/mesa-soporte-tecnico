import { supabase } from "@/lib/supabase/client";
import { Ticket } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";
import { safeGetItem } from "@/lib/storage";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTicketActions(
  tickets: Ticket[],
  onUpdate: () => void,
  currentUser: User | null,
) {
  const queryClient = useQueryClient();

  // --- MUTATION FOR OPTIMISTIC TICKET UPDATES ---
  const ticketMutation = useMutation({
    mutationFn: async ({
      ticketId,
      updates,
    }: {
      ticketId: number;
      updates: Partial<Ticket>;
    }) => {
      const { data, error } = await supabase
        .from("tickets")
        .update(updates)
        .eq("id", ticketId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("Acción bloqueada por permisos (RLS)");
      return data[0];
    },
    onMutate: async ({ ticketId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard-tickets"] });
      const previousTickets = queryClient.getQueryData<Ticket[]>([
        "dashboard-tickets",
      ]);

      queryClient.setQueryData<Ticket[]>(["dashboard-tickets"], (old = []) =>
        old.map((t) => (t.id === ticketId ? { ...t, ...updates } : t)),
      );

      return { previousTickets };
    },
    onError: (err, variables, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(
          ["dashboard-tickets"],
          context.previousTickets,
        );
      }
      alert(
        `Error: ${err instanceof Error ? err.message : "Error al actualizar"}`,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      onUpdate();
    },
  });

  // --- REASSIGN ---
  const handleReassign = async (ticketId: number, newAgentId: string) => {
    if (!newAgentId) return;
    ticketMutation.mutate({
      ticketId,
      updates: { assigned_agent_id: newAgentId },
    });
  };

  // --- TOGGLE HOLD (SLA) ---
  const toggleHold = async (ticket: Ticket) => {
    const isHolding = ticket.status === "EN_ESPERA";
    const newStatus = isHolding ? "EN_PROGRESO" : "EN_ESPERA";
    const updates: Partial<Ticket> = { status: newStatus };

    if (!isHolding) {
      const reason = prompt("Motivo de pausa:");
      if (!reason) return;
      updates.sla_clock_stopped_at = new Date().toISOString();
      updates.hold_reason = reason;
      updates.sla_pause_reason = reason;
      updates.sla_status = "paused";
      if (/repuesto|garant|proveedor|compra/i.test(reason)) {
        updates.status = "EN_ESPERA";
      }
    } else {
      updates.sla_clock_stopped_at = null;
      updates.hold_reason = null;
      updates.sla_pause_reason = null;
      updates.sla_status = "running";
    }

    ticketMutation.mutate({ ticketId: ticket.id, updates });
  };

  // --- CATEGORY CHANGE ---
  const handleCategoryChange = async (
    ticketId: number,
    newCategory: string,
  ) => {
    ticketMutation.mutate({
      ticketId,
      updates: { category: newCategory },
    });
  };

  // --- ADD COMMENT ---
  const saveTicketComment = async (
    ticketId: number,
    newComment: string,
    currentDescription?: string,
  ) => {
    if (!newComment) return;
    const t = tickets.find((ticket) => ticket.id === ticketId);
    const finalDesc = currentDescription || t?.description || "";
    const dateStr = new Date().toLocaleString();
    const newDescription = `${finalDesc}\n\n[${dateStr}] SEGUIMIENTO: ${newComment}`;

    ticketMutation.mutate({
      ticketId,
      updates: { description: newDescription },
    });
  };

  // --- PROMPT COMMENT WRAPPER ---
  const promptAddComment = async (
    ticketId: number,
    currentDescription: string,
  ) => {
    const comment = prompt("Ingrese su comentario de seguimiento:");
    if (!comment) return;
    await saveTicketComment(ticketId, comment, currentDescription);
  };

  // --- UPDATE STATUS ---
  const updateStatus = async (
    ticketId: number,
    newStatus: string,
    solutionText?: string,
  ) => {
    const updates: Partial<Ticket> = { status: newStatus };

    try {
      let userId = currentUser?.id;
      if (!userId) {
        const userStr = safeGetItem("tic_user");
        const user = userStr ? JSON.parse(userStr) : null;
        userId = user?.id;
      }

      if (newStatus === "EN_PROGRESO") {
        if (userId) updates.assigned_agent_id = userId;
      } else if (newStatus === "PENDIENTE") {
        updates.assigned_agent_id = null;
      } else if (newStatus === "RESUELTO") {
        if (userId) updates.assigned_agent_id = userId;
        if (solutionText) {
          updates.solution = solutionText;
          const currentTicket = tickets.find((t) => t.id === ticketId);
          if (currentTicket) {
            const dateStr = new Date().toLocaleString();
            updates.description = `${currentTicket.description || ""}\n\n[${dateStr}] SOLUCIÓN: ${solutionText}`;
          }
        }
      }
    } catch (e) {
      console.warn("Error gestionando asignación:", e);
    }

    ticketMutation.mutate({ ticketId, updates });
  };

  return {
    handleReassign,
    toggleHold,
    handleCategoryChange,
    saveTicketComment,
    promptAddComment,
    updateStatus,
  };
}
