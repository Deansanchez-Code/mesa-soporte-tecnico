import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Ticket } from "@/app/admin/admin.types";
import { User } from "@supabase/supabase-js";

export function useTickets(currentUser: User | null) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<
    { id: string; full_name: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // Calcular fecha límite (15 días atrás)
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 15);
      const limitISO = limitDate.toISOString();

      // Consultamos tickets con sus relaciones (Usuario y Activo)
      // FILTRO: Status NO es (CERRADO o RESUELTO) O CreatedAt >= 15 días
      // Supabase .or syntax: "condition1,condition2"
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
        .or(`status.neq.CERRADO,status.neq.RESUELTO,created_at.gte.${limitISO}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error cargando tickets:", error);
        throw error;
      }

      setTickets(data as Ticket[]);

      // Cargar Agentes para reasignación logic could be moved if it's static or needed elsewhere
      // But keeping it here ensures we have agents available for the UI that consumes this hook
      const { data: agentsData } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("role", ["agent", "admin", "superadmin"]); // Added superadmin just in case

      if (agentsData) {
        setAgents(agentsData);
      }

      setError(null);
    } catch (err: unknown) {
      console.error("❌ Error en fetchTickets:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Error desconocido al cargar tickets";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Realtime Subscription ---
  useEffect(() => {
    const loadData = async () => {
      await fetchTickets(); // Carga inicial
    };

    if (currentUser) void loadData();

    // Suscripción a cambios en la base de datos
    const channel = supabase
      .channel("realtime tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          void fetchTickets(); // Recargar si algo cambia
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, fetchTickets]);

  return { tickets, agents, loading, error, refreshTickets: fetchTickets };
}
