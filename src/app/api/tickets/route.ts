import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth-check";

const ticketSchema = z.object({
  category: z.string().min(1, "Category is required"),
  ticket_type: z.enum(["INC", "REQ"]).default("REQ"),
  asset_serial: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = ticketSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { category, ticket_type, asset_serial, location, description } =
      validationResult.data;

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
          user_id: user.id, // Enforced from session
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
