import {
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
  unauthorized,
} from "@/lib/auth-check";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (!(await verifyUserPermissions(user.id, ["superadmin"])))
      return forbidden("Requires SuperAdmin");

    const supabaseAdmin = getSupabaseAdmin();

    // 1. List all users (pagination might be needed if > 50, but let's assume < 50 for now or loop)
    const {
      data: { users },
      error,
    } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (error) throw error;

    let deletedCount = 0;
    let keptCount = 0;

    for (const user of users) {
      const email = user.email?.toLowerCase() || "";

      // SAFETY CHECK: Keep Deansan
      if (email.includes("deansan")) {
        console.log(`Keeping user: ${email} (${user.id})`);
        keptCount++;
        continue;
      }

      // Delete others
      // Delete others
      // console.log(`Deleting user: ${user.id}`);
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(
        user.id,
      );
      if (delError) {
        console.error(`Failed to delete ${email}:`, delError);
      } else {
        deletedCount++;
      }
    }

    return NextResponse.json({
      message: "Purge complete",
      deleted: deletedCount,
      kept: keptCount,
    });
  } catch (error: unknown) {
    console.error("Purge error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
