import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildUserIdOrFilter, UUID_SCHEMA } from "@/lib/security";
import { hashKioskPin, KIOSK_PIN_REGEX } from "@/lib/kiosk-pin";
import Logger from "@/lib/logger";

const AssignPinSchema = z.object({
  userId: UUID_SCHEMA,
  pin: z
    .string()
    .trim()
    .regex(
      KIOSK_PIN_REGEX,
      "El PIN debe tener exactamente 6 dígitos numéricos",
    ),
});

async function assignKioskPinHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  const isSuperAdmin = await verifyUserPermissions(ctx.user.id, ["superadmin"]);
  if (!isSuperAdmin) {
    return forbidden(
      "Únicamente el SuperAdmin puede asignar o rotar PIN de acceso VIP.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Payload JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = AssignPinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Usuario o PIN inválido (debe ser de 6 dígitos numéricos)." },
      { status: 400 },
    );
  }

  const { userId, pin } = parsed.data;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: targetUser, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, auth_id, username, full_name, role, area, is_active")
    .or(buildUserIdOrFilter(userId))
    .maybeSingle();

  if (userErr || !targetUser) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  if (targetUser.is_active === false) {
    return NextResponse.json(
      { error: "No se puede asignar PIN a una cuenta inactiva" },
      { status: 400 },
    );
  }

  const targetRole = String(targetUser.role || "").toLowerCase();
  if (targetRole === "admin" || targetRole === "superadmin") {
    return NextResponse.json(
      {
        error:
          "Las cuentas administrativas utilizan /login con contraseña, no PIN de Kiosko.",
      },
      { status: 400 },
    );
  }

  const cleanUsername = String(targetUser.username || "")
    .toLowerCase()
    .trim();
  const syntheticEmail = `${cleanUsername}@sistema.local`;
  let targetAuthId = targetUser.auth_id || "";
  let existingAppMeta: Record<string, unknown> = {};

  if (targetAuthId) {
    const { data: authLookup } =
      await supabaseAdmin.auth.admin.getUserById(targetAuthId);
    if (authLookup?.user) {
      existingAppMeta =
        (authLookup.user.app_metadata as Record<string, unknown>) || {};
    } else {
      targetAuthId = "";
    }
  }

  if (!targetAuthId) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const matched = listData?.users.find(
      (u) => u.email?.toLowerCase() === syntheticEmail,
    );
    if (matched) {
      targetAuthId = matched.id;
      existingAppMeta = (matched.app_metadata as Record<string, unknown>) || {};
    }
  }

  const pinHash = hashKioskPin(pin);
  const nowIso = new Date().toISOString();
  const newAppMeta = {
    ...existingAppMeta,
    kiosk_pin_hash: pinHash,
    kiosk_pin_revoked_pending_notice: false,
    kiosk_pin_updated_at: nowIso,
    kiosk_pin_updated_by: ctx.user.id,
  };

  if (!targetAuthId) {
    const randomPassword = crypto.randomBytes(32).toString("base64url");
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: randomPassword,
        email_confirm: true,
        app_metadata: newAppMeta,
        user_metadata: {
          full_name: targetUser.full_name,
          role: targetUser.role,
          area: targetUser.area,
          username: cleanUsername,
        },
      });

    if (createErr || !created?.user) {
      Logger.error(
        "Error provisioning Auth user when assigning PIN",
        createErr,
      );
      return NextResponse.json(
        { error: "No fue posible inicializar la cuenta Auth del usuario" },
        { status: 500 },
      );
    }
    targetAuthId = created.user.id;

    await supabaseAdmin
      .from("users")
      .update({ auth_id: targetAuthId })
      .eq("id", targetUser.id);
  } else {
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthId,
      { app_metadata: newAppMeta },
    );

    if (updateErr) {
      Logger.error("Error saving hashed Kiosk PIN", updateErr);
      return NextResponse.json(
        { error: "No fue posible guardar el PIN de acceso" },
        { status: 500 },
      );
    }

    if (targetAuthId !== targetUser.auth_id) {
      await supabaseAdmin
        .from("users")
        .update({ auth_id: targetAuthId })
        .eq("id", targetUser.id);
    }
  }

  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: ctx.user.id,
      action: "ASSIGN_KIOSK_PIN",
      resource: "users",
      resource_id: targetUser.id,
      details: {
        target_username: cleanUsername,
        updated_at: nowIso,
      },
    });
  } catch (auditErr) {
    Logger.warn("Audit log failed on ASSIGN_KIOSK_PIN", auditErr);
  }

  Logger.info("SuperAdmin assigned 6-digit VIP Kiosk PIN", {
    actorId: ctx.user.id,
    targetUserId: targetUser.id,
    targetUsername: cleanUsername,
  });

  return NextResponse.json({
    success: true,
    userId: targetUser.id,
    has_kiosk_pin: true,
    updatedAt: nowIso,
  });
}

export const POST = withAuth(assignKioskPinHandler);
