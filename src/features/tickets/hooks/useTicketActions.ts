import { supabase } from "@/lib/supabase/cliente";
import { Ticket } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";
import { safeGetItem } from "@/lib/storage";

export function useTicketActions(
  tickets: Ticket[],
  onUpdate: () => void,
  currentUser: User | null,
) {
  // --- REASSIGN ---
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
        }`,
      );
    } else {
      alert("Ticket reasignado correctamente");
      onUpdate();
    }
  };

  // --- TOGGLE HOLD (SLA) ---
  const toggleHold = async (ticket: Ticket) => {
    const isHolding = ticket.status === "EN_ESPERA";

    // Determinamos el nuevo estado
    const newStatus = isHolding ? "EN_PROGRESO" : "EN_ESPERA";

    const updates: Partial<Ticket> = { status: newStatus };

    if (!isHolding) {
      // >>> CONGELAR <<<
      const reason = prompt(
        "Ingrese el motivo de pausa (Ej: Espera Repuesto, Espera Usuario, etc):",
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
        }`,
      );
    } else {
      onUpdate();
    }
  };

  // --- CATEGORY CHANGE ---
  const handleCategoryChange = async (
    ticketId: number,
    newCategory: string,
  ) => {
    const { error } = await supabase
      .from("tickets")
      .update({ category: newCategory })
      .eq("id", ticketId);

    if (error) {
      alert("Error actualizando categoría");
    } else {
      onUpdate();
    }
  };

  // --- ADD COMMENT ---
  const saveTicketComment = async (
    ticketId: number,
    newComment: string,
    currentDescription?: string,
  ) => {
    if (!newComment) return;

    let finalDesc = currentDescription || "";

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
      onUpdate();
    }
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
      // We rely on the hook consumer to pass the currentUser, but here we double check or use local storage as fallback
      // like the original code did, to be safe.
      let userId = currentUser?.id;
      if (!userId) {
        const userStr = safeGetItem("tic_user");
        const user = userStr ? JSON.parse(userStr) : null;
        userId = user?.id;
      }

      if (newStatus === "EN_PROGRESO") {
        // Asignar al usuario actual al tomar el ticket
        if (userId) {
          updates.assigned_agent_id = userId;
        }
      } else if (newStatus === "PENDIENTE") {
        // Desasignar al soltar el ticket
        updates.assigned_agent_id = null;
      } else if (newStatus === "RESUELTO") {
        // Asignar al usuario actual si cierra el ticket ("El que cierra gana")
        if (userId) {
          updates.assigned_agent_id = userId;
        }
        // Guardar la solución si existe
        if (solutionText) {
          updates.solution = solutionText;

          // Buscar el ticket actual para obtener descripción previa
          const currentTicket = tickets.find((t) => t.id === ticketId);
          if (currentTicket) {
            const dateStr = new Date().toLocaleString();
            updates.description =
              (currentTicket.description || "") +
              `\n\n[${dateStr}] SOLUCIÓN: ${solutionText}`;
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

    if (error) {
      console.error("Error actualizando ticket:", error);
      alert(
        `Error actualizando ticket: ${
          error.message || error.details || JSON.stringify(error)
        }`,
      );
    } else if (!data || data.length === 0) {
      // Si no hay error pero no devolvió datos, es probable que RLS lo haya bloqueado silenciosamente
      console.error("Actualización ignorada por RLS (sin permisos)");
      alert(
        "⚠️ No se pudo actualizar el estado. Es posible que no tengas permisos para modificar este ticket o que ya haya sido modificado.",
      );
    } else {
      // Éxito
      const statusMessages: Record<string, string> = {
        EN_PROGRESO: "Ticket atendido correctamente",
        RESUELTO: "Ticket resuelto correctamente",
        EN_ESPERA: "Ticket pausado correctamente",
        PENDIENTE: "Ticket devuelto a pendientes",
      };
      // We do NOT fetchTickets() here, we let the caller do it via onUpdate() callback
      onUpdate();

      alert(statusMessages[newStatus] || "Ticket actualizado");
    }
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
