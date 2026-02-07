import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/cliente";
import { Reservation } from "../types";
import {
  cancelReservationAction,
  createReservationAction,
  updateReservationAction,
  createReservationBatchAction,
} from "../actions/reservationActions";
import { ReservationSchema } from "../schemas";
import { z } from "zod";
import { createTicketAction } from "@/features/tickets/actions/ticketActions";

interface UseReservationsProps {
  userId: string;
  startDate: string;
}

export function useReservations({ userId, startDate }: UseReservationsProps) {
  const queryClient = useQueryClient();

  // 1. Query para Reservas (Filtrado por fecha)
  const {
    data: reservations = [],
    isLoading: loadingReservations,
    refetch: refetchReservations,
  } = useQuery<Reservation[]>({
    queryKey: ["reservations", startDate],
    queryFn: async () => {
      const startOfDay = `${startDate}T00:00:00`;
      const endOfDay = `${startDate}T23:59:59`;

      const { data, error } = await supabase
        .from("reservations")
        .select("*, users(full_name, is_vip)")
        .eq("status", "APPROVED")
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
  ) => {
    const result = await createReservationBatchAction(data);
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

  const updateSupportTicketByDescriptionMatch = async (
    oldDescriptionSubstring: string,
    newDescription: string,
  ) => {
    const { data: tickets, error: searchError } = await supabase
      .from("tickets")
      .select("id")
      .eq("user_id", userId)
      .eq("category", "Reserva Auditorio")
      .ilike("description", `%${oldDescriptionSubstring}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchError || !tickets?.length) return;

    await supabase
      .from("tickets")
      .update({ description: newDescription })
      .eq("id", tickets[0].id);
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
    updateSupportTicketByDescriptionMatch,
  };
}
