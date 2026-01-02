import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

    // Strict Admin check for system fix scripts
    const isAdmin = await verifyUserPermissions(user.id, [
      "superadmin",
      "admin",
    ]);
    if (!isAdmin) return forbidden("Requires Admin or Superadmin role");

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Find User (Public)
    const { data: users, error: findError } = await supabaseAdmin
      .from("users")
      .select("*")
      .ilike("email", "%masanchez%")
      .limit(1);

    if (findError || !users || users.length === 0) {
      return NextResponse.json(
        { error: "User masanchez not found in Public DB" },
        { status: 404 },
      );
    }

    const targetUser = users[0];
    // console.log("Fixing user:", targetUser.email, targetUser.id);

    // 2. Update Public Profile
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        employment_type: "contratista",
        job_category: "instructor", // Correction: User confirmed they are an Instructor.
        is_active: true,
      })
      .eq("id", targetUser.id);

    if (updateError) throw updateError;

    // 3. Update Auth Metadata (if authentication exists)
    // We try to find the auth user. ID should match if synced correctly.
    // If not, we search by email.
    const {
      data: { users: authUsers },
    } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers.find(
      (u) => u.email?.toLowerCase() === targetUser.email?.toLowerCase(),
    );

    if (authUser) {
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...authUser.user_metadata,
          employment_type: "contratista",
          job_category: "instructor",
        },
      });
      // console.log("Auth metadata updated.");
    }

    return NextResponse.json({
      success: true,
      message: "User masanchez reassigned to Contratista/Instructor",
      user: targetUser.email,
    });
  } catch (error: unknown) {
    console.error("Fix error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
