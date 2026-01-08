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
      // Consultamos tickets con sus relaciones (Usuario y Activo)
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
