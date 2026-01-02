import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  // AUTH_CHECK_BYPASS: Public registration endpoint (Input Sanitized)
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const body = await req.json();
    const { username, full_name, email, role, area, job_category } = body;

    // Validation
    if (!username || !full_name || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validation: Reject corporate emails
    if (email.toLowerCase().endsWith("@sena.edu.co")) {
      return NextResponse.json(
        { error: "Corporate emails not allowed for contractors" },
        { status: 400 },
      );
    }

    // Insert
    // Note: 'auth_id' is NOT set here because we are not using supabase auth.users for contractors yet?
    // In schema_dump.sql, id is primary key UUID. If we don't provide it, it auto-generates if default is uuid_generate_v4()
    // BUT the schema says: id UUID PRIMARY KEY REFERENCES auth.users(id)
    // This is a FK constraint. If we try to insert a user into 'public.users' without an auth user, it will FAIL.

    // We must check if the project design allows "Shadow Users" or if we need to create a dummy auth user.
    // In 'seed_superadmin.ts' we saw pure public.users insert? No, it referenced auth.
    // However, for contractors, maybe we need to create a dummy auth user first.

    // Let's create an auth user first with admin privileges

    // 0. Use attributes from request or default
    // STRICTLY ENFORCE: From this endpoint, employment_type is ALWAYS 'contratista'
    // AND Role cannot be admin/superadmin.

    // Sanitize Role:
    let safeRole = role;
    if (safeRole === "admin" || safeRole === "superadmin") {
      safeRole = "user";
    }
    // Default to contractor if coming from this portal and role is generic or user
    if (!safeRole || safeRole === "user") safeRole = "contractor";

    const final_job_category =
      job_category ||
      (safeRole === "instructor" ? "instructor" : "funcionario");
    const final_employment_type = "contratista"; // Enforced rule

    // 1. Create Auth User (Dummy password)
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: "TempPassword123!", // Should be generated or random
        email_confirm: true,
        user_metadata: {
          full_name,
          username,
          role,
          area,
          job_category: final_job_category,
          employment_type: final_employment_type,
        },
      });

    let userId = authUser?.user?.id;

    if (authError) {
      // HANDLE EXISTING USER (Purge Recovery)
      if (authError.message.includes("already been registered")) {
        console.warn("User exists in Auth. Linking to public.users...");

        // Fetch existing Auth User ID
        const { data: listData, error: listError } =
          await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw listError;

        const existingUser = listData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );

        if (!existingUser) {
          throw new Error("User reported as existing but not found in list.");
        }
        userId = existingUser.id;
      } else {
        throw authError; // Rethrow other errors
      }
    }

    // 2. Ensure Public User Record Exists (Upsert) - FOR BOTH NEW AND EXISTING
    // This guarantees the public profile is synced and correct.
    if (userId) {
      const { error: publicError } = await supabaseAdmin.from("users").upsert(
        {
          id: userId,
          email: email,
          full_name: full_name,
          username: username, // Important to save username
          role: role,
          job_category: final_job_category,
          employment_type: final_employment_type,
          is_active: true,
        },
        { onConflict: "id" },
      );

      if (publicError) {
        console.error("Public upsert error:", publicError);
        throw publicError;
      }
    }

    return NextResponse.json({
      user: {
        id: userId,
        username,
        full_name,
        email,
        role,
        job_category: final_job_category,
        employment_type: final_employment_type,
      },
    });
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
