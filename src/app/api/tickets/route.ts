import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

const ticketSchema = z.object({
  category: z.string().min(1, "Category is required"),
  ticket_type: z.enum(["INC", "REQ"]).default("REQ"),
  asset_serial: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  description: z.string().optional(),
});

async function createTicket(req: NextRequest, ctx: AuthenticatedContext) {
  const user = ctx.user;
  const body = await req.json();

  // Use .parse() to take advantage of centralized ZodError handling in withAuth
  const validatedData = ticketSchema.parse(body);

  const { category, ticket_type, asset_serial, location, description } =
    validatedData;

  const supabaseAdmin = getSupabaseAdmin();

  // --- AUTO-ASSIGNMENT LOGIC ---
  let assignedAgentId: string | null = null;
  try {
    // 1. Get all active admins (exclude superadmin)
    const { data: admins } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, full_name")
      .eq("role", "admin")
      .eq("is_active", true);

    if (admins && admins.length > 0) {
      if (admins.length === 1) {
        assignedAgentId = admins[0].auth_id || admins[0].id;
      } else {
        // 2. Get workload for these admins (open tickets)
        const adminIds = admins.map((a) => a.auth_id || a.id);
        const { data: workload } = await supabaseAdmin
          .from("tickets")
          .select("assigned_agent_id")
          .in("assigned_agent_id", adminIds)
          .not("status", "in", '("RESUELTO","CANCELADO")');

        // Count tickets per admin
        const counts: Record<string, number> = {};
        adminIds.forEach((id) => (counts[id] = 0));
        workload?.forEach((t) => {
          if (t.assigned_agent_id) counts[t.assigned_agent_id]++;
        });

        // 3. Find admin with min workload
        const sortedAdmins = Object.entries(counts).sort((a, b) => a[1] - b[1]);
        assignedAgentId = sortedAdmins[0][0];
      }
    }
  } catch (e) {
    console.error("Auto-assignment failed:", e);
    // Continue with unassigned if it fails
  }

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .insert([
      {
        category,
        ticket_type,
        asset_serial,
        location,
        description,
        user_id: user.id, // Enforced from session via withAuth
        status: "PENDIENTE",
        assigned_agent_id: assignedAgentId,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Ticket Creation Error (Supabase):", error);
    return NextResponse.json(
      { error: "Failed to create ticket", detail: error.message },
      { status: 500 },
    );
  }

  console.log("Ticket created successfully in DB:", data.id);
  return NextResponse.json({ data }, { status: 200 });
}

export const POST = withAuth(createTicket);
