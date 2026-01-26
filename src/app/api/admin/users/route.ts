import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

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

// HELPER: Integrated Authorization Check
async function ensureAdmin(userId: string) {
  return await verifyUserPermissions(userId, ["admin", "superadmin"]);
}

// LIST USERS (Support pagination and filtering)
async function listUsersHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  if (!(await ensureAdmin(ctx.user.id))) {
    return forbidden();
  }

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
}

// CREATE USER
async function createUserHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  if (!(await ensureAdmin(ctx.user.id))) {
    return forbidden();
  }

  const body = await request.json();
  const { email, password, full_name, role, area, ...otherData } = body;
  const finalFullName = full_name || body.fullName;

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
        full_name: finalFullName,
        role: role || "user",
        area: area,
        employment_type: otherData.employment_type || "planta",
        job_category: otherData.job_category || "funcionario",
        username: otherData.username || email.split("@")[0],
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

  return NextResponse.json({ success: true, user: authUser.user });
}

// UPDATE USER
async function updateUserHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  if (!(await ensureAdmin(ctx.user.id))) {
    return forbidden();
  }

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

    // Attempt 1: Update by ID
    const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        password: password,
        email: email,
        email_confirm: true,
      },
    );

    if (pwdError) {
      console.error("Error updating Auth User:", pwdError);

      if (pwdError.message.includes("User not found") && email) {
        const { data: newAuth, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            id: id,
            email: email,
            password: password || "TempPass123!",
            email_confirm: true,
            user_metadata: {
              full_name: updates.full_name || "Usuario Recuperado",
              role: updates.role || "agent",
              area: updates.area || "Mesa de Ayuda",
            },
          });

        if (createError) throw createError;
        if (newAuth.user) targetAuthId = newAuth.user.id;
      } else {
        throw pwdError;
      }

      if (targetAuthId !== id) {
        await supabaseAdmin
          .from("users")
          .update({ auth_id: targetAuthId })
          .eq("id", id);
      }
    }
  } else if (email) {
    await supabaseAdmin.auth.admin.updateUserById(id, {
      email: email,
      email_confirm: true,
    });
  }

  // Soft deactivate/reactivate logic
  if (updates.is_active === true) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: "none",
      });
    } catch (e) {
      console.error(e);
    }
    updates.deleted_at = null;
  } else if (updates.is_active === false) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: "876000h",
      });
    } catch (e) {
      console.error(e);
    }
    updates.deleted_at = new Date().toISOString();
  }

  // Prepare DB Updates
  const dbUpdates: Record<string, unknown> = {};
  const allowedFields = [
    "full_name",
    "username",
    "role",
    "area",
    "employment_type",
    "job_category",
    "is_active",
    "is_vip",
    "deleted_at",
    "perm_create_assets",
    "perm_transfer_assets",
    "perm_decommission_assets",
    "perm_manage_assignments",
  ];

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) dbUpdates[field] = updates[field];
  });

  dbUpdates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(dbUpdates)
    .or(`auth_id.eq.${id},id.eq.${id}`);

  if (updateError) throw updateError;

  // Also update metadata in Auth
  const metadataUpdates: Record<string, unknown> = {};
  const metadataFields = [
    "full_name",
    "role",
    "area",
    "username",
    "employment_type",
    "job_category",
    "perm_manage_assignments",
    "is_vip",
  ];

  metadataFields.forEach((field) => {
    if (updates[field] !== undefined) metadataUpdates[field] = updates[field];
  });

  if (Object.keys(metadataUpdates).length > 0) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: metadataUpdates,
      });
    } catch (e) {
      console.error("Metadata update error:", e);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE USER (Soft delete)
async function deleteUserHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  if (!(await ensureAdmin(ctx.user.id))) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID Required" }, { status: 400 });
  }

  // 1. Mark as inactive in Database
  const { error: dbError } = await supabaseAdmin
    .from("users")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("auth_id", id);

  if (dbError) throw dbError;

  // 2. Ban user in Supabase Auth
  await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });

  return NextResponse.json({ success: true, message: "User soft deleted" });
}

// BULK ACTIONS
async function bulkUpdateHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  if (!(await ensureAdmin(ctx.user.id))) {
    return forbidden();
  }

  const body = await request.json();
  const { action, job_category, employment_type } = body;

  if (action && job_category && employment_type === "contratista") {
    const isActive = action === "enable";

    // 1. Update DB
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({
        is_active: isActive,
        deleted_at: isActive ? null : new Date().toISOString(),
      })
      .eq("employment_type", "contratista")
      .eq("job_category", job_category);

    if (dbError) throw dbError;

    // 2. Update Auth
    const { data: targetUsers } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("employment_type", "contratista")
      .eq("job_category", job_category);

    if (targetUsers && targetUsers.length > 0) {
      for (const user of targetUsers) {
        if (user.auth_id) {
          await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
            ban_duration: isActive ? "none" : "876000h",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Acción masiva '${action}' aplicada a ${targetUsers?.length || 0} contratistas`,
    });
  }

  return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
}

export const GET = withAuth(listUsersHandler);
export const POST = withAuth(createUserHandler);
export const PUT = withAuth(updateUserHandler);
export const DELETE = withAuth(deleteUserHandler);
export const PATCH = withAuth(bulkUpdateHandler);
