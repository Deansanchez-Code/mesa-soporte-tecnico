import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, role, area, ...otherData } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // 1. Create User in Supabase Auth
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: role || "user",
          area: area,
        },
      });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authUser.user) {
      return NextResponse.json(
        { error: "No se pudo crear el usuario" },
        { status: 500 }
      );
    }

    // 2. Insert/Update User Profile in Public Table (Sync)
    // The trigger might handle this, but to be sure and add extra fields:
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authUser.user.id, // Explicitly link ID
      auth_id: authUser.user.id,
      email: email,
      full_name: fullName,
      username: otherData.username,
      role: role,
      area: area,
      is_active: true,
      perm_create_assets: otherData.perm_create_assets,
      perm_transfer_assets: otherData.perm_transfer_assets,
      perm_decommission_assets: otherData.perm_decommission_assets,
      is_vip: otherData.is_vip,
    });

    if (profileError) {
      // If profile creation fails, we might want to rollback auth user?
      // For now, let's just log it. The trigger might have already fired.
      console.error("Error creating profile:", profileError);
      // Try update if it already exists (from trigger)
      await supabaseAdmin
        .from("users")
        .update({
          auth_id: authUser.user.id,
          full_name: fullName,
          role: role,
          area: area,
          is_active: true,
          ...otherData,
        })
        .eq("email", email);
    }

    return NextResponse.json({ success: true, user: authUser.user });
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, password, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // 1. Update Password in Supabase Auth (if provided)
    if (password && password.length > 0) {
      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        {
          password: password,
        }
      );
      if (pwdError) throw pwdError;
    }

    // 2. Update Profile in Public Table
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("auth_id", id); // Assuming we receive auth_id as ID from frontend

    if (updateError) throw updateError;

    // Also update metadata in Auth just in case
    if (updates.full_name || updates.role || updates.area) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          full_name: updates.full_name,
          role: updates.role,
          area: updates.area,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update error:", error);
    return NextResponse.json(
      { error: error.message || "Error updating user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID Required" }, { status: 400 });
    }

    // SOFT DELETE STRATEGY

    // 1. Mark as inactive in Database
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("auth_id", id);

    if (dbError) throw dbError;

    // 2. Ban/Block user in Supabase Auth to prevent login
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        ban_duration: "876000h", // 100 years ban (effectively permanent)
      }
    );

    if (authError) {
      console.error("Failed to ban user in Auth:", authError);
      // We continue because DB soft delete is the primary goal for the app logic
    }

    return NextResponse.json({ success: true, message: "User soft deleted" });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Error deleting user" },
      { status: 500 }
    );
  }
}
