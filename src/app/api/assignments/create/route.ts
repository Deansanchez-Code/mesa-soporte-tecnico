import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

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
  time_block: z.enum(["MANANA", "TARDE", "NOCHE"]).or(z.string()),
});

async function createAssignmentsHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  try {
    // 1. Authorization check
    const canManage = await verifyUserPermissions(
      ctx.user.id,
      ["admin", "superadmin"],
      "perm_manage_assignments",
    );
    if (!canManage) return forbidden("No permission to manage assignments");

    const body = await request.json();
    const validatedData = AssignmentSchema.parse(body);

    const { instructor_id, area_id, dates, time_block } = validatedData;

    // 2. Check for conflicts
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("instructor_assignments")
      .select("assignment_date")
      .eq("area_id", area_id)
      .eq("time_block", time_block)
      .in("assignment_date", dates);

    if (checkError) throw checkError;

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

    // 3. Insert
    const payload = dates.map((date: string) => ({
      instructor_id,
      area_id,
      assignment_date: date,
      time_block,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("instructor_assignments")
      .insert(payload);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, count: payload.length });
  } catch (error: unknown) {
    console.error("Server error:", error);
    // withAuth handles ZodError automatically.
    // For other errors, we throw or return 500.
    if (error instanceof ZodError) {
      throw error; // Let withAuth handle ZodError
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown Error" },
      { status: 500 },
    );
  }
}

export const POST = withAuth(createAssignmentsHandler);
