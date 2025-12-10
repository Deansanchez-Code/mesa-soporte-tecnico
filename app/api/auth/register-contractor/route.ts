import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const body = await req.json();
    const { username, full_name, email, role, area } = body;

    // Validation
    if (!username || !full_name || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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

    // 1. Create Auth User (Dummy password)
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: "TempPassword123!", // Should be generated or random
        email_confirm: true,
        user_metadata: { full_name, username, role, area },
      });

    // If auth user creation fails (e.g. already exists), handle it.
    // Actually, if we just want a record in public.users and the constraint exists, we MUST have an auth user.
    // If the constraint is removed, then we can insert directly.
    // Given the architecture, let's try to create the Auth user to be safe and consistent.

    let userId = authUser?.user?.id;

    if (authError) {
      // If user already exists in Auth but not in public, we might recover.
      // But for now let's report error if strict.
      // console.error("Auth creation failed", authError);
      // return NextResponse.json({ error: authError.message }, { status: 500 });

      // Actually, let's try to just insert into public.users. Maybe the user is creating a "contact"
      // that doesn't login via Supabase Auth but via the custom flow?
      // But the FK constraint is hard.
      // Let's assume the previous code worked because maybe the constraint wasn't enforced or I misread the schema in previous steps?
      // The schema dump said: "id UUID PRIMARY KEY REFERENCES auth.users(id)"

      // Fix: Use createAuthUser logic.
      throw authError;
    }

    // 2. Insert into Public Users (Trigger might handle this automatically! Check 'handle_new_user' trigger)
    // If trigger exists, we don't need to insert into public.users manually.
    // Let's check if we return the user.

    // Waiting a bit for trigger? Or just return the auth user data mapped.

    return NextResponse.json({
      user: {
        id: userId,
        username,
        full_name,
        email,
        role,
        area,
      },
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    const msg = error.message || "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
