import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

async function deleteUserUtility(req: NextRequest, ctx: AuthenticatedContext) {
  try {
    // 1. SECURITY CHECK - Ensure Admin
    if (!(await verifyUserPermissions(ctx.user.id, ["admin", "superadmin"]))) {
      return forbidden("Only admins can access this utility");
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Find User in Auth
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) throw listError;

    // Search for targets matching the email pattern
    const targets = users.filter((u) =>
      u.email?.toLowerCase().includes(email.toLowerCase()),
    );

    if (targets.length === 0) {
      return NextResponse.json(
        { message: "User not found in Auth" },
        { status: 404 },
      );
    }

    const results = [];

    for (const user of targets) {
      // Safety: Don't delete SuperAdmin or protected accounts
      if (user.email?.includes("deansan")) {
        results.push({ email: user.email, status: "SKIPPED (Protected)" });
        continue;
      }

      console.log(`Hard-deleting user: ${user.id} (${user.email})`);

      // 2. FORCE CLEANUP Dependencies (Manual Cascade)
      // A. Unassign Assets
      await supabaseAdmin
        .from("assets")
        .update({ assigned_to_user_id: null })
        .eq("assigned_to_user_id", user.id);

      // B. Delete Tickets
      await supabaseAdmin.from("tickets").delete().eq("user_id", user.id); // Updated to use 'user_id' consistent with current schema

      // C. Delete Assignments
      await supabaseAdmin
        .from("instructor_assignments")
        .delete()
        .eq("instructor_id", user.id); // Updated to use instructor_id

      // 3. Delete from Auth
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(
        user.id,
      );

      if (delError) {
        results.push({
          email: user.email,
          status: `ERROR: ${delError.message}`,
        });
      } else {
        // 4. Delete from Public (Explicit cleanup)
        await supabaseAdmin.from("users").delete().eq("auth_id", user.id);

        results.push({ email: user.email, status: "DELETED" });
      }
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Hard-delete utility error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export const POST = withAuth(deleteUserUtility);
