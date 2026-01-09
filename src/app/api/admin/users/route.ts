import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

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

import {
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

// HELPER: Integrated Authentication Check
async function ensureAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request); // No cast needed
  if (!user) return false;
  return await verifyUserPermissions(user.id, ["admin", "superadmin"]);
}

// LIST USERS (Support pagination and filtering)
export async function GET(request: NextRequest) {
  if (!(await ensureAdmin(request))) {
    return forbidden();
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const role = searchParams.get("role");

    let query = supabaseAdmin
      .from("users")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (role) {
      query = query.eq("role", role);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ users, count });
  } catch (error: unknown) {
    console.error("Fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Error fetching users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin(request))) {
    return forbidden();
  }

  try {
    const body = await request.json();
    const { email, password, fullName, role, area, ...otherData } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 },
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
        { status: 500 },
      );
    }

    // 2. Response immediately (Trigger handles the rest)
    // Thanks to the improved trigger `handle_new_user`, we don't need to wait or update manually.
    // The metadata passed in `createUser` is enough.

    return NextResponse.json({ success: true, user: authUser.user });
  } catch (error: unknown) {
    console.error("Server error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await ensureAdmin(request))) {
    return forbidden();
  }

  try {
    const body = await request.json();
    const { id, password, email, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 },
      );
    }

    // 1. Try to Update Password/Auth in Supabase Auth
    if (password && password.length > 0) {
      let targetAuthId = id;

      // Attempt 1: Update by ID (Update Password AND Email to keep sync)
      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        {
          password: password,
          email: email, // Sync email if username changed
          email_confirm: true,
        },
      );

      if (pwdError) {
        console.error("Error updating Auth User:", pwdError);

        // If user not found, try to recover (Re-create)
        if (pwdError.message.includes("User not found") && email) {
          console.log(
            "User not found in Auth, attempting recovery/creation...",
          );
          const { data: newAuth, error: createError } =
            await supabaseAdmin.auth.admin.createUser({
              id: id, // Force preserve ID
              email: email,
              password: password || "TempPass123!",
              email_confirm: true,
              user_metadata: {
                full_name: updates.full_name || "Usuario Recuperado",
                role: updates.role || "agent",
                area: updates.area || "Mesa de Ayuda",
              },
            });

          if (createError) {
            console.error("Failed to restore Auth User:", createError);
            throw createError;
          }

          if (newAuth.user) {
            targetAuthId = newAuth.user.id;
          }
        } else {
          // Other error (e.g. weak password)
          throw pwdError;
        }

        // LINKING: Ensure public table points to this valid Auth ID
        if (targetAuthId !== id) {
          // Update auth_id in public table where id matches the passed id
          const { error: linkError } = await supabaseAdmin
            .from("users")
            .update({ auth_id: targetAuthId })
            .eq("id", id);

          if (linkError) {
            console.warn("Failed to link auth_id:", linkError);
          }
        }
      }
    } else if (email) {
      // Check if email sync is needed even if password didn't change (e.g. username change)
      // This handles the case where ONLY username/email changed
      await supabaseAdmin.auth.admin.updateUserById(id, {
        email: email,
        email_confirm: true,
      });
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

    // 2. Prepare DB Updates (Protect against extra fields and map keys)
    const dbUpdates: Record<string, unknown> = {};

    // MAPPING: Frontend (camelCase) -> DB (snake_case)
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    // Direct matches
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.area) dbUpdates.area = updates.area;
    if (updates.employment_type)
      dbUpdates.employment_type = updates.employment_type;
    if (updates.job_category) dbUpdates.job_category = updates.job_category;
    if (typeof updates.is_active === "boolean")
      dbUpdates.is_active = updates.is_active;
    if (typeof updates.is_vip === "boolean") dbUpdates.is_vip = updates.is_vip;

    // Permissions
    if (typeof updates.perm_create_assets === "boolean")
      dbUpdates.perm_create_assets = updates.perm_create_assets;
    if (typeof updates.perm_transfer_assets === "boolean")
      dbUpdates.perm_transfer_assets = updates.perm_transfer_assets;
    if (typeof updates.perm_decommission_assets === "boolean")
      dbUpdates.perm_decommission_assets = updates.perm_decommission_assets;
    if (typeof updates.perm_manage_assignments === "boolean")
      dbUpdates.perm_manage_assignments = updates.perm_manage_assignments;

    // Update timestamps if needed (Supabase usually handles this via trigger, but we can force it)
    dbUpdates.updated_at = new Date().toISOString();

    // 2. Update Profile in Public Table
    // Try updating by auth_id first
    const { data: updatedByAuth, error: updateError } = await supabaseAdmin
      .from("users")
      .update(dbUpdates)
      .eq("auth_id", id)
      .select();

    if (updateError) throw updateError;

    // If no rows updated (maybe 'id' passed was the PK, not auth_id, or auth_id changed), try updating by 'id' PK
    if (!updatedByAuth || updatedByAuth.length === 0) {
      const { error: retryUpdateError } = await supabaseAdmin
        .from("users")
        .update(dbUpdates)
        .eq("id", id);

      if (retryUpdateError) throw retryUpdateError;
    }

    // Also update metadata in Auth just in case
    if (
      updates.full_name ||
      updates.role ||
      updates.area ||
      updates.employment_type ||
      updates.employment_type ||
      updates.job_category ||
      typeof updates.perm_manage_assignments === "boolean"
    ) {
      const metadataUpdates: Record<string, unknown> = {};

      if (updates.full_name) metadataUpdates.full_name = updates.full_name;
      if (updates.role) metadataUpdates.role = updates.role;
      if (updates.area) metadataUpdates.area = updates.area;
      if (updates.employment_type)
        metadataUpdates.employment_type = updates.employment_type;
      if (updates.job_category)
        metadataUpdates.job_category = updates.job_category;
      if (typeof updates.perm_manage_assignments === "boolean")
        metadataUpdates.perm_manage_assignments =
          updates.perm_manage_assignments;

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

export async function DELETE(request: NextRequest) {
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
      },
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

export async function PATCH(request: NextRequest) {
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
      { status: 400 },
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
