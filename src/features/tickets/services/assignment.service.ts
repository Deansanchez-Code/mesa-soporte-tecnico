import { createClient } from "@/lib/supabase/server";

export class AssignmentService {
  /**
   * Determina el agente ideal para asignar un ticket basado en carga de trabajo.
   * @returns ID del agente asignado o null si no se pudo asignar.
   */
  static async getAutoAssignmentAgent(): Promise<string | null> {
    try {
      const supabase = await createClient();

      // Get all active admins and agents
      const { data: agents } = await supabase
        .from("users")
        .select("id, auth_id")
        .in("role", ["admin", "agent"])
        .eq("is_active", true);

      if (!agents || agents.length === 0) return null;

      if (agents.length === 1) {
        return agents[0].auth_id || agents[0].id;
      }

      const agentIds = agents.map((a) => a.auth_id).filter(Boolean) as string[];

      // Get workload (tickets assigned to these agents that are NOT resolved or cancelled or closed)
      const { data: workload } = await supabase
        .from("tickets")
        .select("assigned_agent_id")
        .in("assigned_agent_id", agentIds)
        .not("status", "in", '("RESUELTO","CANCELADO","CERRADO")');

      const counts: Record<string, number> = {};
      agentIds.forEach((id) => (counts[id] = 0));
      workload?.forEach((t) => {
        if (t.assigned_agent_id) counts[t.assigned_agent_id]++;
      });

      // Find agent with min workload
      // Sort by workload asc
      const sortedAgents = Object.entries(counts).sort((a, b) => a[1] - b[1]);

      // If tie, random or first found (already sorted by stability of sort)
      return sortedAgents[0][0];
    } catch (e) {
      console.error("Auto-assignment failed:", e);
      return null;
    }
  }
}
