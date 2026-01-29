"use server";

import { createClient } from "@/lib/supabase/servidor";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Ticket } from "@/app/admin/admin.types";
import { calculateSLADueDate, getSLAHours } from "@/lib/domain/sla-calculator";

const TicketSchema = z.object({
  category: z.string().min(1, "La categoría es requerida"),
  ticket_type: z.enum(["INC", "REQ"]).default("REQ"),
  asset_serial: z.string().optional().nullable(),
  location: z.string().min(1, "La ubicación es requerida"),
  description: z.string().optional(),
  user_id: z.string().optional(), // Optional for admin-created tickets
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

    // 1.1 Get Public User Profile (to check VIP)
    const { data: publicUser } = await supabase
      .from("users")
      .select("id, is_vip")
      .eq("auth_id", authUser.id)
      .single();

    const isVip = !!publicUser?.is_vip;

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
          const sortedAgents = Object.entries(counts).sort(
            (a, b) => a[1] - b[1],
          );
          assignedAgentId = sortedAgents[0][0];
        }
      }
    } catch (e) {
      console.error("Auto-assignment failed in Server Action:", e);
    }

    // 3. SLA Calculation
    // We create a mock ticket object for the calculator
    const slaHours = getSLAHours({
      is_vip_ticket: isVip,
      ticket_type: ticket_type,
    } as Ticket);
    const createdAt = new Date().toISOString();
    const expectedEndAt = calculateSLADueDate(createdAt, slaHours);

    // 4. Insert
    const { data: result, error } = await supabase
      .from("tickets")
      .insert([
        {
          category,
          ticket_type,
          asset_serial,
          location,
          description,
          user_id: data.user_id || authUser.id,
          status: "PENDIENTE",
          assigned_agent_id: assignedAgentId,
          is_vip_ticket: isVip,
          sla_start_at: createdAt,
          sla_expected_end_at: expectedEndAt.toISOString(),
          sla_status: "running",
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
