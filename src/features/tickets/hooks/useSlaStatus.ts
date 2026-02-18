import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useEffect } from "react";
import { checkAndActivateTicketsAction } from "../actions/slaActions";

export function useSlaStatus() {
  const queryClient = useQueryClient();

  // 1. Obtener el último log de ejecución del Cron
  const { data: lastRun, isLoading } = useQuery({
    queryKey: ["sla-last-run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("created_at, details")
        .eq("action", "CRON_SLA_CHECK")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 es "no rows"
      return data;
    },
    refetchInterval: 1000 * 60 * 5, // Refrescar cada 5 min
  });

  // 2. Disparador Pasivo (Auto-Sync)
  useEffect(() => {
    const triggerIfStale = async () => {
      if (!lastRun) {
        // Si nunca ha corrido, o primer inicio
        await checkAndActivateTicketsAction();
        queryClient.invalidateQueries({ queryKey: ["sla-last-run"] });
        return;
      }

      const lastDate = new Date(lastRun.created_at);
      const diffMinutes =
        (new Date().getTime() - lastDate.getTime()) / (1000 * 60);

      // Si ha pasado más de 1 hora y estamos en horario laboral
      if (diffMinutes > 60) {
        // Validar horario local (7-21)
        const hour = new Date().getHours();
        if (hour >= 7 && hour < 21) {
          console.log("Sincronización pasiva activada por inactividad > 1h");
          await checkAndActivateTicketsAction();
          queryClient.invalidateQueries({ queryKey: ["sla-last-run"] });
        }
      }
    };

    triggerIfStale();
  }, [lastRun, queryClient]);

  return {
    lastRunAt: lastRun?.created_at ? new Date(lastRun.created_at) : null,
    isLoading,
  };
}
