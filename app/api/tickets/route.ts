import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/servidor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const ticketSchema = z.object({
  category: z.string().min(1, "Category is required"),
  asset_serial: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    const { category, asset_serial, location, description } =
      validationResult.data;

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("tickets")
      .insert([
        {
          category,
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
      console.error("Ticket Creation Error:", error);
      return NextResponse.json(
        { error: "Failed to create ticket" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
