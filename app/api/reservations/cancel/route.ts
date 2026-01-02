import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const { reservation_id } = body;

    if (!reservation_id) {
      return NextResponse.json(
        { error: "Missing reservation ID" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // OWNERSHIP CHECK
    const { data: reservation } = await supabaseAdmin
      .from("reservations")
      .select("user_id")
      .eq("id", reservation_id)
      .single();

    if (reservation && reservation.user_id !== user.id) {
      if (!(await verifyUserPermissions(user.id, ["admin", "superadmin"]))) {
        return forbidden("Cannot cancel other users' reservations");
      }
    }

    const { error } = await supabaseAdmin
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", reservation_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
