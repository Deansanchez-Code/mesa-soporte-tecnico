import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

const ReservationSchema = z.object({
  title: z.string().min(3),
  start_time: z.string().datetime({ offset: true }), // ISO8601
  end_time: z.string().datetime({ offset: true }),
  user_id: z.string().uuid(),
  auditorium_id: z.string().optional(),
  resources: z.array(z.string()).optional().nullable(),
});

async function createReservation(req: NextRequest, ctx: AuthenticatedContext) {
  const body = await req.json();
  const parseResult = ReservationSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  const { title, start_time, end_time, user_id, auditorium_id, resources } =
    parseResult.data;

  // Ownership Check
  const supabaseAdmin = getSupabaseAdmin();
  const user = ctx.user; // Auth User

  // Note: user.id is Auth ID. user_id from body is Public ID (UUID from users table).
  // We check if the target public user (user_id) belongs to the authenticated user (user.id).

  // 1. Fetch target user to check link
  const { data: publicUser } = await supabaseAdmin
    .from("users")
    .select("auth_id")
    .eq("id", user_id)
    .single();

  // If the target user doesn't exist OR their auth_id doesn't match the current session user
  if (!publicUser || publicUser.auth_id !== user.id) {
    // Then checks if admin
    const isAdmin = await verifyUserPermissions(user.id, [
      "admin",
      "superadmin",
    ]);
    if (!isAdmin) return forbidden("Cannot create reservation for others");
  }

  // 1. Check Conflicts (Server-side validation)
  const { data: conflicts } = await supabaseAdmin
    .from("reservations")
    .select("id, status, user_id, users(is_vip)")
    .eq("status", "APPROVED")
    .lt("start_time", end_time)
    .gt("end_time", start_time);

  if (conflicts && conflicts.length > 0) {
    // Logic for conflicts (omitted for now as per original code comment)
    return NextResponse.json(
      { error: "Horario no disponible (conflicto detectado)" },
      { status: 409 },
    );
  }

  // 2. Create Reservation
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .insert([
      {
        title,
        start_time,
        end_time,
        user_id,
        auditorium_id: auditorium_id || "1",
        resources,
        status: "APPROVED",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Reservation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export const POST = withAuth(createReservation);
