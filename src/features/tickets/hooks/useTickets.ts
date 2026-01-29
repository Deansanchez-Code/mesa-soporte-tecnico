import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/cliente";
import { Ticket } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";

export function useTickets(currentUser: User | null) {
  const queryClient = useQueryClient();

  // 1. Query para Tickets
  const {
    data: tickets = [],
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
          users:users!tickets_user_id_fkey ( full_name, area ),
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

  // 2. Query para Agentes
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
    staleTime: 1000 * 60 * 5, // Los agentes no cambian tan seguido
  });

  // 3. Realtime Subscription (Invalidación de caché)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel("realtime-dashboard-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          // En lugar de hacer fetch manual, invalidamos para que React Query haga lo suyo
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
