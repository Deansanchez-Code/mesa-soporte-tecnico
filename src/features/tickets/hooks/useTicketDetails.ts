import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Ticket } from "@/app/admin/types";
import { TicketEvent, PauseReason, TimelineItem } from "../types";

interface UseTicketDetailsProps {
  ticket: Ticket;
  currentUser?: { id: string; full_name: string };
  onSuccess?: () => void; // Called after pause/resume to close modal or refresh
}

export function useTicketDetails({
  ticket,
  currentUser,
  onSuccess,
}: UseTicketDetailsProps) {
  // State
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [pauseReasons, setPauseReasons] = useState<PauseReason[]>([]);
  const [processingAction, setProcessingAction] = useState(false);

  // Fetch Data

  const fetchDetails = useCallback(async () => {
    setLoadingEvents(true);

    // 1. Fetch Events
    const { data: eventsData, error: eventsError } = await supabase
      .from("ticket_events")
      .select(
        `
            id, created_at, action_type, old_value, new_value, comment,
            actor:actor_id ( id, full_name )
        `,
      )
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false });

    if (!eventsError && eventsData) {
      // Flatten actor name
      const formatted: TicketEvent[] = eventsData.map(
        (e: {
          id: string;
          created_at: string;
          action_type: string;
          old_value: string | null;
          new_value: string | null;
          comment: string | null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actor: any; // Supabase might infer array or object, handle flexibly
        }) => {
          const actorObj = Array.isArray(e.actor) ? e.actor[0] : e.actor;
          return {
            id: e.id,
            created_at: e.created_at,
            action_type: e.action_type,
            old_value: e.old_value || "",
            new_value: e.new_value || "",
            comment: e.comment || "",
            actor_id: actorObj?.id || undefined,
            actor_name: actorObj?.full_name || "Sistema",
          };
        },
      );
      setEvents(formatted);
    }

    // 2. Fetch Pause Reasons
    const { data: reasonsData } = await supabase
      .from("pause_reasons")
      .select("*")
      .eq("is_active", true);

    if (reasonsData) {
      setPauseReasons(reasonsData);
    }

    setLoadingEvents(false);
  }, [ticket.id]);

  useEffect(() => {
    fetchDetails();
  }, [ticket.id, fetchDetails]);

  // Handle Pause
  const handlePause = async (selectedReason: string, customReason: string) => {
    if (!selectedReason) return;
    setProcessingAction(true);

    const finalReason =
      selectedReason === "OTHER" ? customReason : selectedReason;
    if (!finalReason) {
      setProcessingAction(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          sla_status: "paused",
          sla_pause_reason: finalReason,
          status: /repuesto|garant|proveedor|compra/i.test(finalReason)
            ? "EN_ESPERA" // Automático a En Espera
            : "EN_PROGRESO", // Se mantiene activo (ej. Usuario no responde) pero Sla Pausado
        })
        .eq("id", ticket.id);

      if (error) throw error;

      // TRAZABILIDAD
      if (currentUser?.id) {
        await supabase.from("ticket_events").insert({
          ticket_id: ticket.id,
          actor_id: currentUser.id,
          action_type: "PAUSED",
          comment: `Pausado por: ${finalReason}. (Estado: ${
            /repuesto|garant|proveedor|compra/i.test(finalReason)
              ? "En Espera"
              : "Operativo"
          })`,
        });
      }

      if (onSuccess) onSuccess();
    } catch (e) {
      console.error("Error pausing ticket:", e);
      alert("Error al pausar el ticket.");
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle Resume
  const handleResume = async () => {
    setProcessingAction(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          sla_status: "running",
          status: "EN_PROGRESO",
        })
        .eq("id", ticket.id);

      if (error) throw error;

      if (currentUser?.id) {
        await supabase.from("ticket_events").insert({
          ticket_id: ticket.id,
          actor_id: currentUser.id,
          action_type: "RESUMED",
          comment: "SLA Reanudado manualmente.",
        });
      }

      if (onSuccess) onSuccess();
    } catch (e) {
      console.error("Error resuming ticket:", e);
      alert("Error al reanudar el ticket.");
    } finally {
      setProcessingAction(false);
    }
  };

  // Legacy Description Parser
  const parseDescription = (desc?: string) => {
    if (!desc) return [];
    const parts = desc.split(/\n\n\[/);
    return parts.slice(1).map((part) => {
      const closeBracketIndex = part.indexOf("]");
      if (closeBracketIndex === -1) return { date: "", text: part };
      const date = part.substring(0, closeBracketIndex);
      const text = part
        .substring(closeBracketIndex + 1)
        .replace(" SEGUIMIENTO: ", "")
        .trim();
      return { date, text, isLegacy: true };
    });
  };

  // Timeline Derivation
  const timelineItems: TimelineItem[] = useMemo(() => {
    const legacyUpdates = parseDescription(ticket.description || undefined);

    const items = [
      ...legacyUpdates.map((u) => ({
        type: "legacy" as const,
        date: new Date(u.date).getTime() || 0, // Fallback safe
        displayDate: u.date,
        text: u.text,
        title: "Nota de Seguimiento",
        actor: undefined,
        rawType: undefined,
      })),
      ...events.map((e) => ({
        type: "event" as const,
        date: new Date(e.created_at).getTime(),
        displayDate: new Date(e.created_at).toLocaleString(),
        text: e.comment
          ? e.comment
          : `${e.old_value || "?"} ➔ ${e.new_value || "?"}`,
        title:
          e.action_type === "STATUS_CHANGE"
            ? "Cambio de Estado"
            : e.action_type === "PAUSED"
              ? "Ticket Pausado"
              : e.action_type === "RESUMED"
                ? "Ticket Reanudado"
                : e.action_type,
        actor: e.actor_name,
        rawType: e.action_type,
      })),
      {
        type: "creation" as const,
        date: ticket.created_at
          ? new Date(ticket.created_at).getTime()
          : Date.now(),
        displayDate: ticket.created_at
          ? new Date(ticket.created_at).toLocaleString()
          : "Sin fecha",
        title: "Ticket Creado",
        text: undefined,
        actor: undefined,
        rawType: undefined,
      },
    ];

    return items.sort((a, b) => b.date - a.date);
  }, [ticket.description, ticket.created_at, events]);

  return {
    events,
    loadingEvents,
    pauseReasons,
    processingAction,
    timelineItems,
    handlePause,
    handleResume,
    refreshEvents: fetchDetails, // Expose for manual refresh if needed
  };
}
