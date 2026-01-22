import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

const UpdateReservationSchema = z.object({
  id: z.number(),
  title: z.string().min(3),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  user_id: z.string().uuid(),
  auditorium_id: z.string().optional(),
  resources: z.array(z.string()).optional().nullable(),
});

async function updateReservation(req: NextRequest, ctx: AuthenticatedContext) {
  const body = await req.json();
  const parseResult = UpdateReservationSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  const { id, title, start_time, end_time, user_id, auditorium_id, resources } =
    parseResult.data;

  const supabaseAdmin = getSupabaseAdmin();

  // 1. Ownership or Admin Check
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("reservations")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  // Check if current user is owner (Auth ID vs Public ID logic)
  const user = ctx.user; // Authenticated User (Auth)

  // We get the public ID of the current Auth user
  const { data: publicUser } = await supabaseAdmin
    .from("users")
    .select("id, is_vip, role")
    .eq("auth_id", user.id)
    .single();

  const isOwner = publicUser?.id === existing.user_id;
  const isVip =
    !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";

  if (!isOwner && !isVip) {
    const isAdmin = await verifyUserPermissions(user.id, [
      "admin",
      "superadmin",
    ]);
    if (!isAdmin) return forbidden("Cannot update others' reservations");
  }

  // 2. Conflict Check (ignoring current ID)
  const { data: conflicts } = await supabaseAdmin
    .from("reservations")
    .select("id")
    .eq("status", "APPROVED")
    .neq("id", id)
    .lt("start_time", end_time)
    .gt("end_time", start_time);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "Horario no disponible (conflicto detectado)" },
      { status: 409 },
    );
  }

  // 3. Update Reservation
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .update({
      title,
      start_time,
      end_time,
      user_id, // Permite reasignar si es admin? Sigamos el body.
      auditorium_id: auditorium_id || "1",
      resources,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export const PUT = withAuth(updateReservation);
