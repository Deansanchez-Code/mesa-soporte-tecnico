import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Reservation } from "../types";
import {
  cancelReservationAction,
  createReservationAction,
  updateReservationAction,
  createReservationBatchAction,
} from "../actions/reservationActions";
import { ReservationSchema } from "../schemas";
import { z } from "zod";
import {
  createTicketAction,
  createTicketsBatchAction,
} from "@/features/tickets/actions/ticketActions";

interface UseReservationsProps {
  userId: string;
  startDate: string;
  finalDate?: string;
}

export function useReservations({
  userId,
  startDate,
  finalDate,
}: UseReservationsProps) {
  const queryClient = useQueryClient();

  // 1. Query para Reservas (Filtrado por rango de fecha)
  const {
    data: reservations = [],
    isLoading: loadingReservations,
    refetch: refetchReservations,
  } = useQuery<Reservation[]>({
    queryKey: ["reservations", startDate, finalDate],
    queryFn: async () => {
      const startOfDay = `${startDate}T00:00:00`;
      const endOfDay = `${finalDate || startDate}T23:59:59`;

      const { data, error } = await supabase
        .from("reservations")
        .select("*, users(full_name, is_vip, role)")
        .in("status", ["APPROVED", "PENDING"])
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay)
        .order("start_time");

      if (error) throw error;
      return data as unknown as Reservation[];
    },
    enabled: !!startDate,
  });

  // 2. Query para Status VIP
  const { data: currentUserVip = false } = useQuery({
    queryKey: ["vip-status", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("users")
        .select("is_vip")
        .eq("auth_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data?.is_vip || false;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // VIP status doesn't change often
  });

  // 3. Mutation para Cancelar con Optimismo
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelReservationAction(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ["reservations", startDate],
      });
      const previousReservations = queryClient.getQueryData<Reservation[]>([
        "reservations",
        startDate,
      ]);

      queryClient.setQueryData<Reservation[]>(
        ["reservations", startDate],
        (old = []) => old.filter((r) => r.id !== id),
      );

      return { previousReservations };
    },
    onError: (err, id, context) => {
      if (context?.previousReservations) {
        queryClient.setQueryData(
          ["reservations", startDate],
          context.previousReservations,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
  });

  const cancelReservation = async (reservationId: number) => {
    const result = await cancelMutation.mutateAsync(reservationId);
    if (result.error) throw new Error(result.error);
    return true;
  };

  const createOrUpdateReservation = async (data: {
    id?: number;
    title: string;
    start_time: string;
    end_time: string;
    user_id: string;
    auditorium_id: string;
    resources: string[];
    description?: string | null;
  }) => {
    const result = data.id
      ? await updateReservationAction(data as Required<typeof data>)
      : await createReservationAction(data);

    if (result.error) {
      throw new Error(result.error);
    }

    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    return result.data;
  };

  const createBatchReservations = async (
    data: z.infer<typeof ReservationSchema>[],
    forceVipOverride: boolean = false,
  ) => {
    const result = await createReservationBatchAction(data, forceVipOverride);
    if (result.error) throw new Error(result.error);
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    return result.data;
  };

  const createSupportTicket = async (data: {
    category: string;
    ticket_type: "INC" | "REQ";
    description: string;
    user_id: string;
    location: string;
    event_date?: string | null;
  }) => {
    const result = await createTicketAction(data);
    if (result.error) throw new Error(result.error);
    return result.data;
  };

  const createBatchTickets = async (
    data: Parameters<typeof createTicketsBatchAction>[0],
  ) => {
    const result = await createTicketsBatchAction(data);
    if (result.error) throw new Error(String(result.error));
    return result.data;
  };

  const syncTicketWithReservation = async (
    oldTitle: string,
    newDetails: {
      fullNewDescription: string;
      isoStart: string;
    },
  ) => {
    // 1. Buscar el ticket por el título antiguo y usuario
    // El título original puede estar en un ticket de Auditorio, Subdirección o Biblioteca.
    const oldDescSubstring = `: ${oldTitle}`;

    const { data: tickets, error: searchError } = await supabase
      .from("tickets")
      .select("*")
      .eq("user_id", userId)
      .eq("category", "Reserva Auditorio")
      .ilike("description", `%${oldDescSubstring}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchError || !tickets?.length) {
      console.warn("No se encontró ticket para sincronizar con la reserva.");
      return;
    }

    const ticket = tickets[0];

    // 2. Lógica de Activación/Pausa (Regla 24h)
    const now = new Date();
    const eventStart = new Date(newDetails.isoStart);
    const hoursDiff = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    let newStatus = ticket.status;
    let slaStatus = ticket.sla_status;

    // Solo cambiar estado si el ticket aún no ha sido atendido (está en cola)
    if (["PENDIENTE", "EN_ESPERA"].includes(ticket.status)) {
      if (hoursDiff > 24) {
        newStatus = "EN_ESPERA";
        slaStatus = "paused";
      } else {
        newStatus = "PENDIENTE";
        slaStatus = "running";
      }
    }

    // 4. Actualizar Ticket con sincronización total
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        description: newDetails.fullNewDescription,
        event_date: newDetails.isoStart,
        status: newStatus,
        sla_status: slaStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (updateError) {
      console.error("Error al sincronizar ticket:", updateError);
    } else {
      queryClient.invalidateQueries({ queryKey: ["dashboard-tickets"] });
    }
  };

  return {
    reservations,
    currentUserVip,
    loading: loadingReservations,
    refetch: refetchReservations,
    cancelReservation,
    createOrUpdateReservation,
    createBatchReservations,
    createSupportTicket,
    createBatchTickets,
    syncTicketWithReservation,
  };
}
