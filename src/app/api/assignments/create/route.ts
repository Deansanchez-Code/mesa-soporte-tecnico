import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const AssignmentSchema = z.object({
  instructor_id: z.string().uuid(),
  area_id: z.number().int(),
  dates: z
    .array(
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
    )
    .min(1),
  time_block: z.enum(["MANANA", "TARDE", "NOCHE"]).or(z.string()), // Allow string fallback if enum expands
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const canManage = await verifyUserPermissions(
      user.id,
      ["admin", "superadmin"],
      "perm_manage_assignments",
    );
    if (!canManage) return forbidden("No permission to manage assignments");

    const body = await request.json();

    const parseResult = AssignmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parseResult.error.format() },
        { status: 400 },
      );
    }

    const { instructor_id, area_id, dates, time_block } = parseResult.data;

    // 1. Check for conflicts
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("instructor_assignments")
      .select("assignment_date")
      .eq("area_id", area_id)
      .eq("time_block", time_block)
      .in("assignment_date", dates);

    if (checkError) {
      console.error("Error checking conflicts:", checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      console.warn("[API/Assignments] Conflict detected for dates:", existing);
      return NextResponse.json(
        {
          error: `Conflicto: Ya existen asignaciones en este horario para ${existing.length} de las fechas seleccionadas.`,
          conflicts: existing,
        },
        { status: 409 },
      );
    }

    // 2. Insert
    const payload = dates.map((date: string) => ({
      instructor_id,
      area_id,
      assignment_date: date,
      time_block,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("instructor_assignments")
      .insert(payload);

    if (insertError) {
      console.error("Error inserting assignments:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: payload.length });
  } catch (error: unknown) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown Error" },
      { status: 500 },
    );
  }
}
