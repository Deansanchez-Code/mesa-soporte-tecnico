import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

    // 1. Fetch reservation to check ownership
    const { data: reservation } = await supabaseAdmin
      .from("reservations")
      .select("user_id, start_time")
      .eq("id", reservation_id)
      .single();

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 },
      );
    }

    // 2. We get the public ID of the current Auth user
    const { data: publicUser } = await supabaseAdmin
      .from("users")
      .select("id, is_vip, role")
      .eq("auth_id", user.id)
      .single();

    const isOwner = publicUser?.id === reservation.user_id;
    const isVip =
      !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";

    if (!isOwner && !isVip) {
      const isAdmin = await verifyUserPermissions(user.id, [
        "admin",
        "superadmin",
      ]);
      if (!isAdmin) {
        return forbidden("Cannot cancel other users' reservations");
      }
    }

    // 3. Past/Current Event Check
    const startTime = new Date(reservation.start_time);
    const now = new Date();
    if (now >= startTime) {
      const isAdmin = await verifyUserPermissions(user.id, [
        "admin",
        "superadmin",
      ]);
      if (!isAdmin) {
        return forbidden(
          "No se pueden cancelar eventos en curso o finalizados.",
        );
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
