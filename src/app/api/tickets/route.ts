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
