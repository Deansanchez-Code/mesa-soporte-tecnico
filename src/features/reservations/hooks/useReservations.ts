import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Reservation } from "../types";
import {
  cancelReservationAction,
  createReservationAction,
  updateReservationAction,
  createReservationBatchAction,
  syncReservationTicketAction,
} from "../actions/reservationActions";
import { ReservationSchema } from "../schemas";
import { z } from "zod";
import {
  createTicketAction,
  createTicketsBatchAction,
} from "@/features/tickets/actions/ticketActions";
import {
  mapAreaNameToSpaceId,
  mapLegacyAssignmentToReservation,
  mergeReservationsWithLegacy,
} from "../rules/legacyAssignmentsAdapter";

interface UseReservationsProps {
  userId: string;
  startDate: string;
  finalDate?: string;
}

// Canal compartido con conteo de referencias para evitar colisiones cuando múltiples
// vistas (Calendario + Formulario Split) montan `useReservations` simultáneamente.
let sharedReservationsChannel: ReturnType<typeof supabase.channel> | null =
  null;
let reservationsChannelSeq = 0;
const reservationsRealtimeListeners = new Set<() => void>();

export function subscribeReservationsRealtime(
  onChange: () => void,
): () => void {
  reservationsRealtimeListeners.add(onChange);

  if (!sharedReservationsChannel) {
    const channelName = `reservations-realtime-${++reservationsChannelSeq}`;
    sharedReservationsChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
        },
        () => {
          reservationsRealtimeListeners.forEach((fn) => fn());
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "instructor_assignments",
        },
        () => {
          reservationsRealtimeListeners.forEach((fn) => fn());
        },
      )
      .subscribe();
  }

  return () => {
    reservationsRealtimeListeners.delete(onChange);
    if (reservationsRealtimeListeners.size === 0 && sharedReservationsChannel) {
      const ch = sharedReservationsChannel;
      sharedReservationsChannel = null;
      supabase.removeChannel(ch);
    }
  };
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
      const endDate = finalDate || startDate;
      // Rango en hora local de Colombia (-05:00) para incluir reservas nocturnas (>= 19:00)
      const startOfDay = `${startDate}T00:00:00-05:00`;
      const endOfDay = `${endDate}T23:59:59-05:00`;

      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, title, start_time, end_time, status, user_id, auditorium_id, resources, description, users(full_name, is_vip, role)",
        )
        .in("status", ["APPROVED", "PENDING"])
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay)
        .order("start_time");

      if (error) throw error;
      const baseReservations = (data || []) as unknown as Reservation[];

      // Incorporar asignaciones heredadas vigentes de `instructor_assignments` (ej. Ambiente 107, Cocina)
      try {
        const { data: areasData } = await supabase
          .from("areas")
          .select("id, name");

        const areaNameById = new Map<number, string>();
        for (const area of areasData || []) {
          if (mapAreaNameToSpaceId(area.name)) {
            areaNameById.set(area.id, area.name);
          }
        }

        const specialAreaIds = Array.from(areaNameById.keys());
        if (specialAreaIds.length > 0) {
          const { data: legacyRows } = await supabase
            .from("instructor_assignments")
            .select("id, area_id, instructor_id, assignment_date, time_block")
            .in("area_id", specialAreaIds)
            .gte("assignment_date", startDate)
            .lte("assignment_date", endDate);

          if (legacyRows && legacyRows.length > 0) {
            const instructorIds = Array.from(
              new Set(
                legacyRows.map((row) => row.instructor_id).filter(Boolean),
              ),
            );
            const instructorNames = new Map<string, string>();

            if (instructorIds.length > 0) {
              const { data: userRows } = await supabase
                .from("users")
                .select("id, full_name")
                .in("id", instructorIds);
              for (const u of userRows || []) {
                if (u.full_name) instructorNames.set(u.id, u.full_name);
              }
            }

            const mappedLegacy = legacyRows
              .map((row) =>
                mapLegacyAssignmentToReservation(
                  {
                    ...row,
                    instructorName: instructorNames.get(row.instructor_id),
                  },
                  areaNameById.get(row.area_id),
                ),
              )
              .filter((item): item is Reservation => item !== null);

            return mergeReservationsWithLegacy(baseReservations, mappedLegacy);
          }
        }
      } catch (legacyErr) {
        console.warn("No se pudieron cargar asignaciones legacy:", legacyErr);
      }

      return baseReservations;
    },
    enabled: !!startDate,
  });

  // 1.5 Suscripción en vivo (Supabase Realtime) compartida sobre la tabla reservations
  useEffect(() => {
    return subscribeReservationsRealtime(() => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    });
  }, [queryClient]);

  // 2. Query para Status VIP
  const { data: currentUserVip = false } = useQuery({
    queryKey: ["vip-status", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("users")
        .select("is_vip, role")
        .or(`auth_id.eq.${userId},id.eq.${userId}`)
        .maybeSingle();

      if (error) throw error;
      return !!data?.is_vip || data?.role?.toLowerCase() === "vip";
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 mins
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
    return {
      data: result.data,
      pendingApproval: Boolean(result.pendingApproval),
    };
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
      previousUserId?: string;
      newUserId?: string;
    },
  ) => {
    const res = await syncReservationTicketAction({
      oldTitle,
      previousUserId: newDetails.previousUserId || userId,
      newUserId: newDetails.newUserId || userId,
      fullNewDescription: newDetails.fullNewDescription,
      isoStart: newDetails.isoStart,
    });
    if (res.success) {
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
