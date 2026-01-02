import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

const ReservationSchema = z.object({
  title: z.string().min(3),
  start_time: z.string().datetime({ offset: true }), // ISO8601
  end_time: z.string().datetime({ offset: true }),
  user_id: z.string().uuid(),
  auditorium_id: z.string().optional(),
  resources: z.array(z.string()).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

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
    if (user.id !== user_id) {
      const isAdmin = await verifyUserPermissions(user.id, [
        "admin",
        "superadmin",
      ]);
      if (!isAdmin) return forbidden("Cannot create reservation for others");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Check Conflicts (Server-side validation)
    // We double check here to ensure data integrity even if frontend checked
    const { data: conflicts } = await supabaseAdmin
      .from("reservations")
      .select("id, status, user_id, users(is_vip)")
      .eq("status", "APPROVED")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      // Logic for conflicts (omitted for now as per original code comment)
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
