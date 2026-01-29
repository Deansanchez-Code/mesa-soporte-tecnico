import { createClient } from "@/lib/supabase/servidor";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TicketSchema = z.object({
  category: z.string().min(1, "La categoría es requerida"),
  ticket_type: z.enum(["INC", "REQ"]).default("REQ"),
  asset_serial: z.string().optional().nullable(),
  location: z.string().min(1, "La ubicación es requerida"),
  description: z.string().optional(),
});

export async function createTicketAction(data: z.infer<typeof TicketSchema>) {
  try {
    const parseResult = TicketSchema.safeParse(data);
    if (!parseResult.success) {
      throw new Error("Datos de ticket inválidos");
    }

    const { category, ticket_type, asset_serial, location, description } =
      parseResult.data;
    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    // 2. AUTO-ASSIGNMENT LOGIC
    let assignedAgentId: string | null = null;
    try {
      // Get all active admins and agents
      const { data: agents } = await supabase
        .from("users")
        .select("id, auth_id")
        .in("role", ["admin", "agent"])
        .eq("is_active", true);

      if (agents && agents.length > 0) {
        if (agents.length === 1) {
          assignedAgentId = agents[0].auth_id || agents[0].id;
        } else {
          const agentIds = agents
            .map((a) => a.auth_id)
            .filter(Boolean) as string[];

          // Get workload (tickets assigned to these agents that are NOT resolved or cancelled)
          const { data: workload } = await supabase
            .from("tickets")
            .select("assigned_agent_id")
            .in("assigned_agent_id", agentIds)
            .not("status", "in", '("RESUELTO","CANCELADO")');

          const counts: Record<string, number> = {};
          agentIds.forEach((id) => (counts[id] = 0));
          workload?.forEach((t) => {
            if (t.assigned_agent_id) counts[t.assigned_agent_id]++;
          });

          // Find agent with min workload
          const sortedAgents = Object.entries(counts).sort(
            (a, b) => a[1] - b[1],
          );
          assignedAgentId = sortedAgents[0][0];
        }
      }
    } catch (e) {
      console.error("Auto-assignment failed in Server Action:", e);
    }

    // 3. Insert
    const { data: result, error } = await supabase
      .from("tickets")
      .insert([
        {
          category,
          ticket_type,
          asset_serial,
          location,
          description,
          user_id: authUser.id,
          status: "PENDIENTE",
          assigned_agent_id: assignedAgentId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : "Error al crear ticket",
    };
  }
}
