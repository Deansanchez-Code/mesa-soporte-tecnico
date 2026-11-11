import { NextResponse } from "next/server";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import Logger from "@/lib/logger";

async function listInstructorsHandler(
  _req: Request,
  ctx: AuthenticatedContext,
) {
  const canList = await verifyUserPermissions(
    ctx.user.id,
    ["agent", "admin", "superadmin", "coordinator", "vip"],
    "perm_manage_assignments",
  );
  if (!canList) {
    return forbidden("No tienes permisos para listar instructores");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, full_name, role, job_category")
    .neq("role", "superadmin")
    .or(
      "job_category.eq.instructor,job_category.eq.Instructor,role.eq.instructor",
    )
    .order("full_name");

  if (error) {
    Logger.error("[API/Instructors] DB Error", error);
    return NextResponse.json(
      { error: "Error consultando directorio de instructores" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export const GET = withAuth(listInstructorsHandler);
