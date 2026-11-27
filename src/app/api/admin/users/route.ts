import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildUserIdOrFilter, UUID_SCHEMA } from "@/lib/security";
import { isPrivilegedKioskUser } from "@/lib/kiosk-pin";
import {
  getCachedKioskPinSet,
  markKioskPinCachedStatus,
  setCachedKioskPinSet,
} from "@/lib/kiosk-pin-cache";
import {
  isSuperAdminRole,
  isSupportRole,
  shouldDeactivateOnVigenciaRollover,
} from "@/lib/vigencia-rules";
import Logger from "@/lib/logger";

const USER_PUBLIC_COLUMNS =
  "id, auth_id, full_name, username, email, role, area, employment_type, job_category, is_active, is_vip, perm_create_assets, perm_transfer_assets, perm_decommission_assets, perm_manage_assignments, created_at, updated_at";

const CreateUserSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener mínimo 8 caracteres")
    .max(128),
  full_name: z.string().trim().min(2).max(120).optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z
    .enum([
      "user",
      "agent",
      "admin",
      "superadmin",
      "vip",
      "coordinator",
      "instructor",
      "contractor",
      "staff",
    ])
    .optional(),
  area: z.string().trim().max(120).nullable().optional(),
  employment_type: z.string().trim().max(60).optional(),
  job_category: z.string().trim().max(60).optional(),
  username: z.string().trim().max(80).optional(),
  is_vip: z.boolean().optional(),
  perm_manage_assignments: z.boolean().optional(),
  perm_create_assets: z.boolean().optional(),
  perm_transfer_assets: z.boolean().optional(),
  perm_decommission_assets: z.boolean().optional(),
});

const UpdateUserSchema = z.object({
  id: UUID_SCHEMA,
  email: z.string().trim().email().optional(),
  password: z
    .string()
    .min(8, "La contraseña debe tener mínimo 8 caracteres")
    .max(128)
    .optional()
    .or(z.literal("")),
  full_name: z.string().trim().min(2).max(120).optional(),
  username: z.string().trim().max(80).optional(),
  role: z
    .enum([
      "user",
      "agent",
      "admin",
      "superadmin",
      "vip",
      "coordinator",
      "instructor",
      "contractor",
      "staff",
    ])
    .optional(),
  area: z.string().trim().max(120).nullable().optional(),
  employment_type: z.string().trim().max(60).nullable().optional(),
  job_category: z.string().trim().max(60).nullable().optional(),
  is_active: z.boolean().optional(),
  is_vip: z.boolean().optional(),
  perm_create_assets: z.boolean().nullable().optional(),
  perm_transfer_assets: z.boolean().nullable().optional(),
  perm_decommission_assets: z.boolean().nullable().optional(),
  perm_manage_assignments: z.boolean().optional(),
});

const BulkUpdateSchema = z.union([
  z.object({
    action: z.enum(["enable", "disable"]),
    job_category: z.string().trim().min(1).max(60),
    employment_type: z.literal("contratista"),
  }),
  z.object({
    action: z.literal("rollover_vigencia"),
  }),
]);

async function ensureAdmin(userId: string) {
  return await verifyUserPermissions(userId, ["admin", "superadmin"]);
}

async function ensureSuperAdmin(userId: string) {
  return await verifyUserPermissions(userId, ["superadmin"]);
}

// LIST USERS (Support pagination and filtering with explicit projection & bounded limits)
async function listUsersHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  if (!(await ensureAdmin(ctx.user.id))) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "100", 10);
  const rawOffset = Number.parseInt(searchParams.get("offset") || "0", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 2000)
    : 100;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  const role = searchParams.get("role");

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("users")
    .select(USER_PUBLIC_COLUMNS, { count: "exact" })
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (role) {
    query = query.eq("role", role);
  }

  const { data: users, error, count } = await query;

  if (error) throw error;

  let pinSetByAuthId = getCachedKioskPinSet();
  if (!pinSetByAuthId) {
    const freshPinSet = new Set<string>();
    let listSucceeded = false;
    try {
      for (let page = 1; page <= 3; page++) {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        const batch = authList?.users || [];
        listSucceeded = true;
        for (const au of batch) {
          const hash = (au.app_metadata as Record<string, unknown> | undefined)
            ?.kiosk_pin_hash;
          if (typeof hash === "string" && hash.length > 0) {
            freshPinSet.add(au.id);
          }
        }
        if (batch.length < 1000) break;
      }
    } catch (pinLookupErr) {
      Logger.warn("No se pudo consultar estado de PIN Kiosko", pinLookupErr);
    }
    if (listSucceeded) {
      setCachedKioskPinSet(freshPinSet);
    }
    pinSetByAuthId = freshPinSet;
  }

  const enrichedUsers = (users || []).map((u) => ({
    ...u,
    has_kiosk_pin: pinSetByAuthId.has(u.auth_id || u.id),
  }));

  return NextResponse.json({ users: enrichedUsers, count });
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
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de usuario inválidos o contraseña menor a 8 caracteres" },
      { status: 400 },
    );
  }

  const { email, password, full_name, fullName, role, area, ...otherData } =
    parsed.data;

  // Regla de gobernanza: solo el Superadmin está autorizado para crear cuentas de soporte (agent) o superadmin
  if (isSupportRole(role) || isSuperAdminRole(role)) {
    if (!(await ensureSuperAdmin(ctx.user.id))) {
      return NextResponse.json(
        {
          error:
            "Solo el Superadmin está autorizado para crear o habilitar usuarios de soporte técnico.",
        },
        { status: 403 },
      );
    }
  }

  const finalFullName = full_name || fullName || otherData.username || email;

  const isCoordinator =
    (otherData.job_category || "").toLowerCase() === "coordinador";
  const effectiveVip = isCoordinator ? true : Boolean(otherData.is_vip);
  const effectiveManageAssignments = isCoordinator
    ? true
    : Boolean(otherData.perm_manage_assignments);

  const supabaseAdmin = getSupabaseAdmin();

  // 1. Create User in Supabase Auth
  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: finalFullName,
        role: role || "user",
        area,
        employment_type: otherData.employment_type || "planta",
        job_category: otherData.job_category || "funcionario",
        username: otherData.username || email.split("@")[0],
        is_vip: effectiveVip,
        perm_manage_assignments: effectiveManageAssignments,
      },
    });

  if (authError) {
    Logger.error("Error creating auth user", authError);
    return NextResponse.json(
      { error: "No fue posible crear el usuario en Auth" },
      { status: 400 },
    );
  }

  if (!authUser.user) {
    return NextResponse.json(
      { error: "No se pudo crear el usuario" },
      { status: 500 },
    );
  }

  await supabaseAdmin
    .from("users")
    .update({
      is_vip: effectiveVip,
      perm_manage_assignments: effectiveManageAssignments,
      employment_type: otherData.employment_type || "planta",
      job_category: otherData.job_category || "funcionario",
      perm_create_assets: Boolean(otherData.perm_create_assets),
      perm_transfer_assets: Boolean(otherData.perm_transfer_assets),
      perm_decommission_assets: Boolean(otherData.perm_decommission_assets),
    })
    .or(buildUserIdOrFilter(authUser.user.id));

  Logger.info("Admin created user", {
    actorId: ctx.user.id,
    createdUserId: authUser.user.id,
    role: role || "user",
  });

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
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos de actualización inválidos o contraseña débil (<8 chars)",
      },
      { status: 400 },
    );
  }

  const { id, password, email, ...updates } = parsed.data;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: previousUser } = await supabaseAdmin
    .from("users")
    .select(
      "id, auth_id, username, role, job_category, is_vip, perm_manage_assignments",
    )
    .or(buildUserIdOrFilter(id))
    .maybeSingle();

  const targetAuthLookupId = previousUser?.auth_id || id;

  // Regla de gobernanza: solo el Superadmin puede habilitar, editar o promover cuentas de soporte (agent) o superadmin
  if (
    isSupportRole(previousUser?.role) ||
    isSupportRole(updates.role) ||
    isSuperAdminRole(previousUser?.role) ||
    isSuperAdminRole(updates.role)
  ) {
    if (!(await ensureSuperAdmin(ctx.user.id))) {
      return NextResponse.json(
        {
          error:
            "Solo el Superadmin está autorizado para modificar o habilitar cuentas de soporte técnico.",
        },
        { status: 403 },
      );
    }
  }

  if (password && password.length > 0) {
    let targetAuthId = targetAuthLookupId;

    const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthLookupId,
      {
        password,
        ...(email ? { email, email_confirm: true } : {}),
      },
    );

    if (pwdError) {
      Logger.error("Error updating Auth User", pwdError);

      if (pwdError.message.includes("User not found") && email) {
        const { data: newAuth, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            id: targetAuthLookupId,
            email,
            password,
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

      if (targetAuthId !== targetAuthLookupId) {
        await supabaseAdmin
          .from("users")
          .update({ auth_id: targetAuthId })
          .or(buildUserIdOrFilter(id));
      }
    }
  } else if (email) {
    await supabaseAdmin.auth.admin.updateUserById(targetAuthLookupId, {
      email,
      email_confirm: true,
    });
  }

  // Soft deactivate/reactivate logic
  const dbUpdates: Record<string, unknown> = {};
  if (updates.is_active === true) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(targetAuthLookupId, {
        ban_duration: "none",
      });
    } catch (e) {
      Logger.warn("Auth unban failed", e);
    }
  } else if (updates.is_active === false) {
    if (id === ctx.user.id || targetAuthLookupId === ctx.user.id) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propia cuenta administrativa" },
        { status: 400 },
      );
    }
    try {
      await supabaseAdmin.auth.admin.updateUserById(targetAuthLookupId, {
        ban_duration: "876000h",
      });
    } catch (e) {
      Logger.warn("Auth ban failed", e);
    }
  }

  const allowedFields = [
    "full_name",
    "username",
    "role",
    "area",
    "employment_type",
    "job_category",
    "is_active",
    "is_vip",
    "perm_create_assets",
    "perm_transfer_assets",
    "perm_decommission_assets",
    "perm_manage_assignments",
  ] as const;

  const updatesRecord = { ...updates } as Record<string, unknown>;
  const prevJobCat = (previousUser?.job_category || "").toLowerCase();
  const incomingJobCat =
    typeof updatesRecord.job_category === "string"
      ? updatesRecord.job_category.toLowerCase()
      : undefined;
  const effectiveRoleLower = String(
    (updatesRecord.role as string | undefined) ?? previousUser?.role ?? "",
  ).toLowerCase();

  const isExplicitlyRevokingVip = updatesRecord.is_vip === false;
  const isDemotingFromCoordinator =
    prevJobCat === "coordinador" &&
    incomingJobCat !== undefined &&
    incomingJobCat !== "coordinador";

  if (isExplicitlyRevokingVip) {
    // Al retirar explícitamente VIP (p. ej. ex-coordinador que vuelve a planta),
    // limpiar privilegios residuales para evitar solicitud de PIN/contraseña.
    if (
      incomingJobCat === "coordinador" ||
      (!incomingJobCat && prevJobCat === "coordinador")
    ) {
      updatesRecord.job_category = "funcionario";
    }
    updatesRecord.perm_manage_assignments = false;
    if (effectiveRoleLower === "vip" || effectiveRoleLower === "coordinator") {
      updatesRecord.role = "user";
    }
  } else if (incomingJobCat === "coordinador") {
    updatesRecord.is_vip = true;
    updatesRecord.perm_manage_assignments = true;
  } else if (isDemotingFromCoordinator) {
    if (updatesRecord.perm_manage_assignments === undefined) {
      updatesRecord.perm_manage_assignments = false;
    }
    if (updatesRecord.is_vip === undefined) {
      updatesRecord.is_vip = false;
    }
    if (
      effectiveRoleLower === "coordinator" ||
      (effectiveRoleLower === "vip" && updatesRecord.is_vip === false)
    ) {
      updatesRecord.role = "user";
    }
  }

  for (const field of allowedFields) {
    if (updatesRecord[field] !== undefined) {
      dbUpdates[field] = updatesRecord[field];
    }
  }

  dbUpdates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(dbUpdates)
    .or(buildUserIdOrFilter(id));

  if (updateError) throw updateError;

  if (previousUser) {
    const mergedAfter = {
      role: (updatesRecord.role as string | undefined) ?? previousUser.role,
      username:
        (updatesRecord.username as string | undefined) ?? previousUser.username,
      job_category:
        (updatesRecord.job_category as string | null | undefined) ??
        previousUser.job_category,
      is_vip:
        (updatesRecord.is_vip as boolean | undefined) ?? previousUser.is_vip,
      perm_manage_assignments:
        (updatesRecord.perm_manage_assignments as boolean | undefined) ??
        previousUser.perm_manage_assignments,
    };

    const wasPrivileged = isPrivilegedKioskUser(previousUser);
    const willBePrivileged = isPrivilegedKioskUser(mergedAfter);

    if (wasPrivileged && !willBePrivileged) {
      try {
        const { data: authInfo } =
          await supabaseAdmin.auth.admin.getUserById(targetAuthLookupId);
        const existingAppMeta =
          (authInfo?.user?.app_metadata as Record<string, unknown>) || {};
        await supabaseAdmin.auth.admin.updateUserById(targetAuthLookupId, {
          app_metadata: {
            ...existingAppMeta,
            kiosk_pin_hash: null,
            kiosk_pin_revoked_pending_notice: true,
            kiosk_pin_revoked_at: new Date().toISOString(),
          },
        });
        markKioskPinCachedStatus(targetAuthLookupId, false);
      } catch (revokeErr) {
        Logger.warn(
          "No se pudo limpiar PIN al retirar privilegio VIP",
          revokeErr,
        );
      }
    } else if (!wasPrivileged && willBePrivileged) {
      try {
        const { data: authInfo } =
          await supabaseAdmin.auth.admin.getUserById(targetAuthLookupId);
        const existingAppMeta =
          (authInfo?.user?.app_metadata as Record<string, unknown>) || {};
        if (existingAppMeta.kiosk_pin_revoked_pending_notice) {
          await supabaseAdmin.auth.admin.updateUserById(targetAuthLookupId, {
            app_metadata: {
              ...existingAppMeta,
              kiosk_pin_revoked_pending_notice: false,
            },
          });
        }
      } catch (promoErr) {
        Logger.warn(
          "No se pudo actualizar estado PIN al promover a VIP",
          promoErr,
        );
      }
    }
  }

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
  ] as const;

  for (const field of metadataFields) {
    if (updatesRecord[field] !== undefined) {
      metadataUpdates[field] = updatesRecord[field];
    }
  }

  if (Object.keys(metadataUpdates).length > 0) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(targetAuthLookupId, {
        user_metadata: metadataUpdates,
      });
    } catch (e) {
      Logger.warn("Metadata update error", e);
    }
  }

  Logger.info("Admin updated user", {
    actorId: ctx.user.id,
    targetId: id,
    changedFields: Object.keys(dbUpdates),
  });

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
  const parsedId = UUID_SCHEMA.safeParse(searchParams.get("id"));
  if (!parsedId.success) {
    return NextResponse.json({ error: "Valid UUID Required" }, { status: 400 });
  }

  const id = parsedId.data;
  if (id === ctx.user.id) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta" },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("role")
    .or(buildUserIdOrFilter(id))
    .maybeSingle();

  if (isSupportRole(targetUser?.role) || isSuperAdminRole(targetUser?.role)) {
    if (!(await ensureSuperAdmin(ctx.user.id))) {
      return NextResponse.json(
        {
          error:
            "Solo el Superadmin está autorizado para desactivar cuentas de soporte técnico.",
        },
        { status: 403 },
      );
    }
  }

  const { error: dbError } = await supabaseAdmin
    .from("users")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .or(buildUserIdOrFilter(id));

  if (dbError) throw dbError;

  await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });

  Logger.warn("Admin soft-deactivated user", {
    actorId: ctx.user.id,
    targetId: id,
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
  const parsed = BulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Cambio de vigencia anual: desactiva todos los contratistas y soportes (agent);
  // funcionarios de planta, VIP y superadmin permanecen activos.
  if (parsed.data.action === "rollover_vigencia") {
    if (!(await ensureSuperAdmin(ctx.user.id))) {
      return NextResponse.json(
        {
          error:
            "Solo el Superadmin está autorizado para ejecutar el cambio de vigencia anual.",
        },
        { status: 403 },
      );
    }

    const { data: allUsers, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, role, employment_type, is_vip, is_active");

    if (fetchError) throw fetchError;

    const toDeactivate = (allUsers || []).filter(
      (u) => u.is_active !== false && shouldDeactivateOnVigenciaRollover(u),
    );

    const affectedSupports = toDeactivate.filter((u) =>
      isSupportRole(u.role),
    ).length;
    const affectedContractors = toDeactivate.length - affectedSupports;

    if (toDeactivate.length > 0) {
      const targetIds = toDeactivate.map((u) => u.id);
      const { error: deactivateError } = await supabaseAdmin
        .from("users")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", targetIds);

      if (deactivateError) throw deactivateError;

      for (const targetUser of toDeactivate) {
        const authTarget = targetUser.auth_id || targetUser.id;
        if (authTarget) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(authTarget, {
              ban_duration: "876000h",
            });
          } catch (banErr) {
            Logger.warn("No se pudo suspender sesión Auth en vigencia", banErr);
          }
        }
      }
    }

    Logger.warn("Superadmin executed annual vigencia rollover", {
      actorId: ctx.user.id,
      affectedContractors,
      affectedSupports,
      totalAffected: toDeactivate.length,
    });

    return NextResponse.json({
      success: true,
      affectedContractors,
      affectedSupports,
      totalAffected: toDeactivate.length,
      message: `Cambio de vigencia aplicado: ${affectedContractors} contratista(s) y ${affectedSupports} soporte(s) desactivados. Planta, VIP y Superadmin permanecen activos.`,
    });
  }

  const { action, job_category } = parsed.data;
  const isActive = action === "enable";

  const { error: dbError } = await supabaseAdmin
    .from("users")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("employment_type", "contratista")
    .eq("job_category", job_category);

  if (dbError) throw dbError;

  const { data: targetUsers } = await supabaseAdmin
    .from("users")
    .select("auth_id")
    .eq("employment_type", "contratista")
    .eq("job_category", job_category);

  if (targetUsers && targetUsers.length > 0) {
    for (const targetUser of targetUsers) {
      if (targetUser.auth_id) {
        await supabaseAdmin.auth.admin.updateUserById(targetUser.auth_id, {
          ban_duration: isActive ? "none" : "876000h",
        });
      }
    }
  }

  Logger.warn("Admin applied bulk contractor access change", {
    actorId: ctx.user.id,
    action,
    job_category,
    affected: targetUsers?.length || 0,
  });

  return NextResponse.json({
    success: true,
    message: `Acción masiva '${action}' aplicada a ${targetUsers?.length || 0} contratistas`,
  });
}

export const GET = withAuth(listUsersHandler);
export const POST = withAuth(createUserHandler);
export const PUT = withAuth(updateUserHandler);
export const DELETE = withAuth(deleteUserHandler);
export const PATCH = withAuth(bulkUpdateHandler);
