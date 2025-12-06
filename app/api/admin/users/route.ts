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

// HELPER: Verify requester is Admin
async function verifyAdmin(request: Request) {
  // Use a standard client to check the auth token passed in headers
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return false;

  // Check role in public.users
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" || profile?.role === "superadmin";
}

export async function POST(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
          employment_type: otherData.employment_type || "planta",
          job_category: otherData.job_category || "funcionario",
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

    // 2. Wait for Trigger and Update Profile (Sync)
    // The DB trigger 'on_auth_user_created' creates the public.users row immediately.
    // We just need to update the extra fields that might not be in the basic metadata sync.

    // Tiny delay to ensure trigger has fired (usually instant, but safety first in async serverless)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { error: profileError } = await supabaseAdmin
      .from("users")
      .update({
        full_name: fullName,
        username: otherData.username || email.split("@")[0],
        role: role,
        area: area,
        is_active: true,
        employment_type: otherData.employment_type || "planta",
        job_category: otherData.job_category || "funcionario",
        perm_create_assets: otherData.perm_create_assets,
        perm_transfer_assets: otherData.perm_transfer_assets,
        perm_decommission_assets: otherData.perm_decommission_assets,
        is_vip: otherData.is_vip,
      })
      .eq("id", authUser.user.id);

    if (profileError) {
      console.error("Error updating profile extras:", profileError);
      // Not critical to fail the whole request if user exists, but good to know.
    }

    return NextResponse.json({ success: true, user: authUser.user });
  } catch (error: unknown) {
    console.error("Server error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, password, email, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // 1. Try to Update Password in Supabase Auth
    if (password && password.length > 0) {
      let targetAuthId = id;

      // Attempt 1: Update by ID
      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        { password: password }
      );

      if (pwdError) {
        console.log(
          `Update by ID ${id} failed: ${pwdError.message}. Trying recovery by email ${email}...`
        );

        // Attempt 2: Find user by Email (maybe ID mismatch?) or Create
        if (email) {
          // Find existing
          const { data: output } = await supabaseAdmin.auth.admin.listUsers();
          // Note: Pagination defaults to 50. In large orgs this might miss users, but filtering by email directly is not standard in admin-js
          const existingUser = output.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
          );

          if (existingUser) {
            console.log(`Found existing user by email: ${existingUser.id}`);
            targetAuthId = existingUser.id;
            const { error: retryError } =
              await supabaseAdmin.auth.admin.updateUserById(targetAuthId, {
                password: password,
              });
            if (retryError) throw retryError;
          } else {
            // Create new
            console.log(
              `Auth User not found. Creating new Auth user with PRESERVED ID: ${id}...`
            );
            const { data: newAuth, error: createError } =
              await supabaseAdmin.auth.admin.createUser({
                id: id, // <--- CRITICAL: Force the Auth ID to match the Public ID
                email: email,
                password: password || "TempPass123!",
                email_confirm: true,
                user_metadata: {
                  full_name: updates.full_name || "Usuario Recuperado",
                  role: updates.role || "agent",
                },
              });

            if (createError) {
              console.error("Failed to restore Auth User:", createError);
              throw createError; // If ID is taken by another auth user, we have a bigger collision problem.
            }

            if (newAuth.user) {
              targetAuthId = newAuth.user.id; // Should match id
            }
          }

          // LINKING: Ensure public table points to this valid Auth ID
          if (targetAuthId !== id) {
            // Update auth_id in public table where id matches the passed id
            const { error: linkError } = await supabaseAdmin
              .from("users")
              .update({ auth_id: targetAuthId })
              .eq("id", id);

            if (linkError) {
              console.log("Relinking public user auth_id failed.");
            } else {
              console.log("Relinked public user to correct Auth ID.");
            }
          }
        } else {
          throw pwdError; // No email to recover with
        }
      }
    }

    // SPECIAL CASE: If is_active is toggled to TRUE, must unban in Auth.
    if (updates.is_active === true) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: "none",
        });
      } catch (error) {
        console.error("Error unbanning user in Auth:", error);
      }
      updates.deleted_at = null;
    } else if (updates.is_active === false) {
      // Ban
      try {
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: "876000h",
        });
      } catch (error) {
        console.error("Error banning user in Auth:", error);
      }
      updates.deleted_at = new Date().toISOString();
    }

    // 2. Update Profile in Public Table
    // Try updating by auth_id first
    const { data: updatedByAuth, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("auth_id", id)
      .select();

    if (updateError) throw updateError;

    // If no rows updated (maybe 'id' passed was the PK, not auth_id, or auth_id changed), try updating by 'id' PK
    if (!updatedByAuth || updatedByAuth.length === 0) {
      console.log(
        "Profile update via auth_id returned 0 rows. Trying via ID (PK)..."
      );
      const { error: retryUpdateError } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", id);

      if (retryUpdateError) throw retryUpdateError;
    }

    // Also update metadata in Auth just in case
    if (
      updates.full_name ||
      updates.role ||
      updates.area ||
      updates.employment_type ||
      updates.job_category
    ) {
      const metadataUpdates: Record<string, unknown> = {};

      if (updates.full_name) metadataUpdates.full_name = updates.full_name;
      if (updates.role) metadataUpdates.role = updates.role;
      if (updates.area) metadataUpdates.area = updates.area;
      if (updates.employment_type)
        metadataUpdates.employment_type = updates.employment_type;
      if (updates.job_category)
        metadataUpdates.job_category = updates.job_category;

      try {
        await supabaseAdmin.auth.admin.updateUserById(id, {
          user_metadata: metadataUpdates,
        });
      } catch (error) {
        console.error("Error updating metadata in Auth:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Update error:", error);
    const message =
      error instanceof Error ? error.message : "Error updating user";
    return NextResponse.json({ error: message }, { status: 500 });
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
  } catch (error: unknown) {
    console.error("Delete error:", error);
    const message =
      error instanceof Error ? error.message : "Error deleting user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { action, job_category, employment_type } = body;

    // BULK ACTION CHECK
    if (action && job_category && employment_type === "contratista") {
      const isActive = action === "enable";

      // 1. Update DB (Soft Delete / Restore)
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({
          is_active: isActive,
          deleted_at: isActive ? null : new Date().toISOString(),
        })
        .eq("employment_type", "contratista")
        .eq("job_category", job_category);

      if (dbError) throw dbError;

      // 2. Update Auth (Ban / Unban)
      const { data: targetUsers } = await supabaseAdmin
        .from("users")
        .select("auth_id")
        .eq("employment_type", "contratista")
        .eq("job_category", job_category);

      if (targetUsers && targetUsers.length > 0) {
        for (const user of targetUsers) {
          if (user.auth_id) {
            if (isActive) {
              await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
                ban_duration: "none",
              });
            } else {
              await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
                ban_duration: "876000h",
              });
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Acción masiva '${action}' aplicada a ${
          targetUsers?.length || 0
        } contratistas (${job_category})`,
      });
    }

    return NextResponse.json(
      { error: "Parámetros de acción masiva inválidos" },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Bulk update error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Error procesando actualización masiva";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
