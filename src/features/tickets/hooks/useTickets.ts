import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/cliente";
import { Ticket } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";

export function useTickets(currentUser: User | null) {
  const queryClient = useQueryClient();

  // 1. Query para Tickets
  const {
    data: rawTickets = [],
    isLoading: loadingTickets,
    isFetching: fetchingTickets,
    error: ticketError,
    refetch: refreshTickets,
  } = useQuery<Ticket[]>({
    queryKey: ["dashboard-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
          *,
          users:users!tickets_user_id_fkey ( full_name, area, is_vip ),
          assigned_agent:users!tickets_assigned_agent_id_fkey ( full_name ),
          assets ( model, type, serial_number )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Ticket[];
    },
    enabled: !!currentUser,
  });

  // 2. Ordenamiento por Prioridad
  const tickets = useMemo(() => {
    if (!rawTickets) return [];

    return [...rawTickets].sort((a, b) => {
      // Priority 1: VIP (is_vip from user profile or is_vip_ticket flag)
      const aIsVip = a.is_vip_ticket || a.users?.is_vip;
      const bIsVip = b.is_vip_ticket || b.users?.is_vip;

      if (aIsVip && !bIsVip) return -1;
      if (!aIsVip && bIsVip) return 1;

      // Priority 2: Not Auditorium Reservation (Direct Support)
      const aIsAuditorium = a.category?.toLowerCase().includes("auditorio");
      const bIsAuditorium = b.category?.toLowerCase().includes("auditorio");

      if (!aIsAuditorium && bIsAuditorium) return -1;
      if (aIsAuditorium && !bIsAuditorium) return 1;

      // Priority 3: Creation Date (desc)
      return (
        new Date(b.created_at || "").getTime() -
        new Date(a.created_at || "").getTime()
      );
    });
  }, [rawTickets]);

  // 3. Query para Agentes
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("role", ["agent", "admin", "superadmin"]);

      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 5,
  });

  // 4. Realtime Subscription
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel("realtime-dashboard-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-tickets"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, queryClient]);

  const isLoading = loadingTickets || loadingAgents;
  const isFetching = fetchingTickets;
  const error = ticketError instanceof Error ? ticketError.message : null;

  return {
    tickets,
    agents,
    loading: isLoading || isFetching,
    error,
    refreshTickets,
  };
}
