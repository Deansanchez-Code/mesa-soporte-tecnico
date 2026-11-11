import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";
import Logger from "@/lib/logger";

const DeleteUserSchema = z.object({
  email: z.string().trim().email("Debe proporcionar un correo exacto válido"),
});

async function deleteUserUtility(req: NextRequest, ctx: AuthenticatedContext) {
  try {
    // 1. SECURITY CHECK - Strict SuperAdmin only for hard deletes
    if (!(await verifyUserPermissions(ctx.user.id, ["superadmin"]))) {
      return forbidden("Only SuperAdmins can access this utility");
    }

    const body = await req.json();
    const parsed = DeleteUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid exact email required" },
        { status: 400 },
      );
    }

    const exactEmail = parsed.data.email.toLowerCase();
    const supabaseAdmin = getSupabaseAdmin();

    // 2. Find exact matching user in Auth (never wildcard substring `.includes()`)
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) throw listError;

    const target = users.find((u) => u.email?.toLowerCase() === exactEmail);
    if (!target) {
      return NextResponse.json(
        { message: "User not found in Auth" },
        { status: 404 },
      );
    }

    if (target.id === ctx.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta activa" },
        { status: 400 },
      );
    }

    Logger.warn("Hard-deleting user by SuperAdmin", {
      actorId: ctx.user.id,
      targetId: target.id,
    });

    // 3. FORCE CLEANUP Dependencies
    await supabaseAdmin
      .from("assets")
      .update({ assigned_to_user_id: null })
      .eq("assigned_to_user_id", target.id);

    await supabaseAdmin.from("tickets").delete().eq("user_id", target.id);

    await supabaseAdmin
      .from("instructor_assignments")
      .delete()
      .eq("instructor_id", target.id);

    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(
      target.id,
    );

    if (delError) {
      Logger.error("Error hard-deleting auth user", delError);
      return NextResponse.json(
        { error: "No fue posible eliminar la cuenta" },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("users").delete().eq("auth_id", target.id);

    return NextResponse.json({
      results: [{ email: target.email, status: "DELETED" }],
    });
  } catch (error: unknown) {
    Logger.error("Hard-delete utility error", error);
    return NextResponse.json(
      { error: "Error interno eliminando usuario" },
      { status: 500 },
    );
  }
}

export const POST = withAuth(deleteUserUtility);
