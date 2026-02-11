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

  // 2. Ordenamiento por Prioridad Dinámica
  const tickets = useMemo(() => {
    if (!rawTickets) return [];

    const now = new Date();

    return [...rawTickets].sort((a, b) => {
      // Función auxiliar para extraer fecha/hora de auditorio si existe
      const getAuditoriumDate = (ticket: Ticket) => {
        if (!ticket.category?.toLowerCase().includes("auditorio")) return null;
        const desc = ticket.description || "";
        const dateMatch = desc.match(/Fecha: (\d{2,4}[-/]\d{2}[-/]\d{2,4})/);
        const timeMatch = desc.match(/Hora: (\d{2}:\d{2})/);

        if (dateMatch && timeMatch) {
          const dateStr = dateMatch[1].replace(/\//g, "-");
          const [p1, p2, p3] = dateStr.split("-");
          let normalizedDate;

          if (p1.length === 4) {
            // YYYY-MM-DD
            normalizedDate = `${p1}-${p2}-${p3}`;
          } else {
            // DD-MM-YYYY
            normalizedDate = `${p3}-${p2}-${p1}`;
          }
          return new Date(`${normalizedDate}T${timeMatch[1]}`);
        }
        return null;
      };

      const dateA = getAuditoriumDate(a);
      const dateB = getAuditoriumDate(b);

      const getPriority = (ticket: Ticket, eventDate: Date | null) => {
        // 1. Auditorio < 24h -> Cabeza (0)
        if (eventDate) {
          const hoursDiff =
            (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 0 && hoursDiff < 24) return 0;
          if (hoursDiff >= 48) return 5; // Congelado (> 2 días) -> Cola (5)
          if (hoursDiff >= 24 && hoursDiff < 48) return 3; // Auditorio próximo (3)
        }

        // 2. VIP (1)
        if (ticket.is_vip_ticket || ticket.users?.is_vip) return 1;

        // 3. REQ HW/SW (2)
        const cat = ticket.category?.toLowerCase() || "";
        if (cat.includes("hardware") || cat.includes("software")) return 2;

        return 4; // Otros (4)
      };

      const prioA = getPriority(a, dateA);
      const prioB = getPriority(b, dateB);

      if (prioA !== prioB) return prioA - prioB;

      // Desempate específico para Auditorios (Prioridad 0 y 3): El evento más próximo va primero
      if ((prioA === 0 || prioA === 3) && dateA && dateB) {
        return dateA.getTime() - dateB.getTime();
      }

      // Desempate general: por fecha de creación (más reciente arriba)
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

  // 5. Realtime Subscription
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
