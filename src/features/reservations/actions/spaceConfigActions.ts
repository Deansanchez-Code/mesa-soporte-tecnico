"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { EmailService } from "@/lib/email/email-service";
import { SpaceReservationEmail } from "@/lib/email/templates/SpaceReservationEmail";
import { SpaceCoordinatorAssignment, EnvironmentsGlobalConfig } from "../types";
import { DEFAULT_SPACE_COORDINATORS } from "../constants";
import Logger from "@/lib/logger";
import { isValidUuid } from "@/lib/security";
import {
  getSpaceDisplayName,
  isBackupAdminIdentity,
  isCoordinatorPrivilegeUsername,
  resolveReservationUserEmail,
} from "../rules/reservationHelpers";
import { resolveAuthenticatedPublicUser } from "../services/reservationAuthServer";

export async function getSpaceCoordinator(
  spaceId: string | number,
): Promise<SpaceCoordinatorAssignment> {
  const sid = String(spaceId);
  try {
    const adminSupabase = getSupabaseAdmin();
    const { data } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    const config = data?.value as EnvironmentsGlobalConfig | undefined;
    if (config?.coordinators && config.coordinators[sid]) {
      const assigned = config.coordinators[sid];
      if (assigned.email && assigned.email.includes("@")) {
        return assigned;
      }
    }
  } catch (err) {
    console.error(`Error obteniendo coordinador para espacio ${sid}:`, err);
  }
  return (
    DEFAULT_SPACE_COORDINATORS[sid] || {
      user_id: "",
      username: "admin",
      email: "jeavendano@sena.edu.co",
      full_name: "Administración TIC",
      is_vip: true,
    }
  );
}

export async function isUserSpaceCoordinator(
  username?: string | null,
  email?: string | null,
  spaceId?: string | number,
): Promise<boolean> {
  const cleanU = (username || "").toLowerCase().trim();
  const cleanE = (email || "").toLowerCase().trim();
  if (isBackupAdminIdentity(cleanU)) return true;

  try {
    const adminSupabase = getSupabaseAdmin();
    const { data } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    const config = data?.value as EnvironmentsGlobalConfig | undefined;
    const coordinators = config?.coordinators || {};

    const checkMatch = (coord: SpaceCoordinatorAssignment) => {
      if (cleanU && coord.username && cleanU === coord.username.toLowerCase())
        return true;
      if (cleanE && coord.email && cleanE === coord.email.toLowerCase())
        return true;
      if (
        cleanE &&
        coord.username &&
        cleanE.startsWith(coord.username.toLowerCase() + "@")
      )
        return true;
      return false;
    };

    if (spaceId) {
      const sid = String(spaceId);
      const coord = coordinators[sid] || DEFAULT_SPACE_COORDINATORS[sid];
      if (coord && checkMatch(coord)) return true;
      return false;
    }

    for (const sid of ["3", "4", "5"]) {
      const coord = coordinators[sid] || DEFAULT_SPACE_COORDINATORS[sid];
      if (coord && checkMatch(coord)) return true;
    }
  } catch (err) {
    console.error("Error en isUserSpaceCoordinator:", err);
  }
  return false;
}

export async function getEnvironmentsGlobalConfigAction() {
  try {
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    const val = (data?.value || {}) as EnvironmentsGlobalConfig;

    return {
      success: true,
      config: {
        tab_order: Array.isArray(val.tab_order)
          ? val.tab_order.map(Number)
          : [],
        disabled_area_ids: Array.isArray(val.disabled_area_ids)
          ? val.disabled_area_ids.map(Number)
          : [],
        disabled_special_spaces: Array.isArray(val.disabled_special_spaces)
          ? val.disabled_special_spaces.map(String)
          : [],
        coordinators: val.coordinators || {},
        updated_at: val.updated_at,
        updated_by: val.updated_by,
      },
    };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al consultar configuración de ambientes",
      config: {
        tab_order: [] as number[],
        disabled_area_ids: [] as number[],
        disabled_special_spaces: [] as string[],
        coordinators: {},
      },
    };
  }
}

export async function saveEnvironmentsTabOrderAction(
  tabOrder: number[],
  accessToken?: string,
) {
  try {
    const publicUser = await resolveAuthenticatedPublicUser(accessToken);
    if (!publicUser) throw new Error("No autenticado");

    const roleLower = (publicUser?.role || "").toLowerCase();
    const jobCatLower = (publicUser?.job_category || "").toLowerCase();
    const cleanUsername = (publicUser?.username || "").toLowerCase().trim();

    const isSuperAdmin = roleLower === "superadmin";
    const isCoordinator =
      jobCatLower === "coordinador" ||
      roleLower === "coordinator" ||
      !!publicUser?.perm_manage_assignments ||
      isCoordinatorPrivilegeUsername(cleanUsername);

    if (!isSuperAdmin && !isCoordinator) {
      throw new Error(
        "Solo las Coordinaciones y el SuperAdmin están autorizados para modificar y fijar el orden de las pestañas de los ambientes.",
      );
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: existing } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    const currentVal = (existing?.value || {}) as EnvironmentsGlobalConfig;

    const newConfig: EnvironmentsGlobalConfig = {
      tab_order: tabOrder,
      disabled_area_ids: Array.isArray(currentVal.disabled_area_ids)
        ? currentVal.disabled_area_ids
        : [],
      disabled_special_spaces: Array.isArray(currentVal.disabled_special_spaces)
        ? currentVal.disabled_special_spaces
        : [],
      coordinators: currentVal.coordinators || {},
      updated_at: new Date().toISOString(),
      updated_by: publicUser?.full_name || cleanUsername || "Coordinación",
    };

    const { error } = await adminSupabase.from("system_settings").upsert(
      {
        key: "environments_global_config",
        value: newConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: true, config: newConfig };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al guardar el orden de los ambientes",
    };
  }
}

export async function toggleSpaceStatusBySuperAdminAction(params: {
  areaId?: number;
  specialSpaceId?: string;
  enabled: boolean;
  accessToken?: string;
}) {
  try {
    const publicUser = await resolveAuthenticatedPublicUser(params.accessToken);
    if (!publicUser) throw new Error("No autenticado");

    const roleLower = (publicUser?.role || "").toLowerCase();
    if (roleLower !== "superadmin") {
      throw new Error(
        "Acceso denegado: Únicamente el SuperAdmin tiene el poder de habilitar o deshabilitar espacios institucionales.",
      );
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: existing } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    const currentVal = (existing?.value || {}) as EnvironmentsGlobalConfig;

    let disabledAreaIds = Array.isArray(currentVal.disabled_area_ids)
      ? [...currentVal.disabled_area_ids]
      : [];
    let disabledSpecialSpaces = Array.isArray(
      currentVal.disabled_special_spaces,
    )
      ? [...currentVal.disabled_special_spaces]
      : [];

    if (typeof params.areaId === "number") {
      if (params.enabled) {
        disabledAreaIds = disabledAreaIds.filter((id) => id !== params.areaId);
      } else if (!disabledAreaIds.includes(params.areaId)) {
        disabledAreaIds.push(params.areaId);
      }
    }

    if (params.specialSpaceId) {
      if (params.enabled) {
        disabledSpecialSpaces = disabledSpecialSpaces.filter(
          (id) => id !== params.specialSpaceId,
        );
      } else if (!disabledSpecialSpaces.includes(params.specialSpaceId)) {
        disabledSpecialSpaces.push(params.specialSpaceId);
      }
    }

    const newConfig: EnvironmentsGlobalConfig = {
      tab_order: Array.isArray(currentVal.tab_order)
        ? currentVal.tab_order
        : [],
      disabled_area_ids: disabledAreaIds,
      disabled_special_spaces: disabledSpecialSpaces,
      coordinators: currentVal.coordinators || {},
      updated_at: new Date().toISOString(),
      updated_by: publicUser?.full_name || "SuperAdmin",
    };

    const { error } = await adminSupabase.from("system_settings").upsert(
      {
        key: "environments_global_config",
        value: newConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: true, config: newConfig };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al cambiar el estado del espacio",
    };
  }
}

export async function assignSpaceCoordinatorAction(params: {
  spaceId: string;
  userId: string | null;
  customEmail?: string;
  customName?: string;
  accessToken?: string;
}) {
  try {
    const publicUser = await resolveAuthenticatedPublicUser(params.accessToken);
    if (!publicUser) throw new Error("No autenticado");

    const roleLower = (publicUser?.role || "").toLowerCase();
    if (roleLower !== "superadmin") {
      throw new Error(
        "Acceso denegado: Únicamente el SuperAdmin tiene autorización para modificar el correo de destino o coordinador de ambientes.",
      );
    }

    const adminSupabase = getSupabaseAdmin();
    const sid = String(params.spaceId);

    if (!["1", "2", "3", "4", "5"].includes(sid)) {
      throw new Error("Espacio no válido para asignación de coordinación");
    }

    const { data: existing } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    const currentVal = (existing?.value || {}) as EnvironmentsGlobalConfig;
    const currentCoordinators = { ...(currentVal.coordinators || {}) };

    let assignedCoordinator: SpaceCoordinatorAssignment | null = null;
    let transferredCount = 0;
    const spaceName = getSpaceDisplayName(sid);

    if (params.userId) {
      if (!isValidUuid(params.userId)) {
        throw new Error("Identificador de funcionario inválido.");
      }

      const { data: targetUser, error: userError } = await adminSupabase
        .from("users")
        .select(
          "id, full_name, username, email, is_vip, role, job_category, employment_type, perm_manage_assignments",
        )
        .eq("id", params.userId)
        .single();

      if (userError || !targetUser) {
        throw new Error("Usuario no encontrado en la base de datos.");
      }

      if (!targetUser.is_vip || !targetUser.perm_manage_assignments) {
        const { error: elevateError } = await adminSupabase
          .from("users")
          .update({
            is_vip: true,
            perm_manage_assignments: true,
            job_category: targetUser.job_category || "coordinador",
          })
          .eq("id", targetUser.id);
        if (elevateError) {
          Logger.warn(
            "No se pudo elevar privilegios VIP del coordinador asignado",
            { userId: targetUser.id, error: elevateError.message },
          );
        }
      }

      const finalEmail =
        params.customEmail && params.customEmail.includes("@")
          ? params.customEmail.trim().toLowerCase()
          : resolveReservationUserEmail(targetUser);

      assignedCoordinator = {
        user_id: targetUser.id,
        username: targetUser.username || "",
        email: finalEmail,
        full_name:
          params.customName?.trim() || targetUser.full_name || "Coordinador",
        is_vip: true,
        assigned_at: new Date().toISOString(),
        assigned_by: publicUser?.full_name || "Administración",
      };

      currentCoordinators[sid] = assignedCoordinator;
    } else if (params.customEmail && params.customEmail.includes("@")) {
      const cleanCustomEmail = params.customEmail.trim().toLowerCase();
      const derivedUser = cleanCustomEmail.split("@")[0];
      assignedCoordinator = {
        user_id: "",
        username: derivedUser,
        email: cleanCustomEmail,
        full_name:
          params.customName?.trim() ||
          `Responsable ${spaceName} (${derivedUser})`,
        is_vip: true,
        assigned_at: new Date().toISOString(),
        assigned_by: publicUser?.full_name || "Administración",
      };
      currentCoordinators[sid] = assignedCoordinator;
    } else {
      delete currentCoordinators[sid];
    }

    if (assignedCoordinator) {
      const nowIso = new Date().toISOString();
      const { data: pendingReservations } = await adminSupabase
        .from("reservations")
        .select(
          "id, title, start_time, end_time, user_id, users(full_name, email)",
        )
        .eq("auditorium_id", sid)
        .eq("status", "PENDING")
        .gte("end_time", nowIso);

      transferredCount = pendingReservations?.length || 0;

      if (assignedCoordinator.user_id) {
        await adminSupabase.from("user_notifications").insert([
          {
            user_id: assignedCoordinator.user_id,
            title: `Nueva Designación Institucional: ${spaceName}`,
            message:
              transferredCount > 0
                ? `Debido a tu rol institucional, a partir de ahora recibirás las solicitudes de prerreserva y requerimientos especiales de ${spaceName}. Se han trasladado ${transferredCount} solicitud(es) pendiente(s) a tu bandeja.`
                : `Debido a tu rol institucional, a partir de ahora recibirás las notificaciones de solicitudes de prerreserva y requerimientos especiales asociadas a ${spaceName}.`,
            type: "INFO",
            read: false,
          },
        ]);
      }

      if (
        assignedCoordinator.email &&
        assignedCoordinator.email.includes("@")
      ) {
        const eventsList =
          transferredCount > 0
            ? (pendingReservations || [])
                .map(
                  (r) =>
                    `• "${r.title}" - Fecha: ${new Date(r.start_time).toLocaleDateString("es-CO")} (${new Date(r.start_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}) | Solicitante: ${(r.users as unknown as { full_name?: string })?.full_name || "Instructor"}`,
                )
                .join("\n")
            : "";

        const roleExplanation =
          `Debido a tu nuevo rol y responsabilidades dentro de la institución, te informamos que a partir de este momento tu correo electrónico (${assignedCoordinator.email}) ha sido configurado como destinatario oficial para recibir las notificaciones de:\n` +
          `• Solicitudes de prerreserva (para autorización o programación).\n` +
          `• Solicitudes de requerimientos especiales y logística para ${spaceName} y ambientes especiales asociados.\n` +
          (transferredCount > 0
            ? `\nAdicionalmente, se han trasladado a tu gestión ${transferredCount} solicitud(es) pendiente(s) de autorización:\n\n${eventsList}`
            : `\nCualquier nueva solicitud o requerimiento especial registrado en la plataforma para ${spaceName} será remitido automáticamente a tu bandeja.`);

        await EmailService.send({
          to: assignedCoordinator.email,
          subject: `[Designación Institucional SENA] Nuevo rol de recepción de prerreservas y requerimientos especiales — ${spaceName}`,
          react: SpaceReservationEmail({
            spaceName,
            requesterName:
              publicUser?.full_name || "Administración del Sistema",
            eventTitle: `Asignación de Rol: Recepción de Prerreservas y Requerimientos Especiales (${spaceName})`,
            date: new Date().toLocaleDateString("es-CO", {
              timeZone: "America/Bogota",
            }),
            timeRange: "Vigencia Activa",
            specialRequirements: roleExplanation,
            coordinatorName: assignedCoordinator.full_name,
            type: "NEW_REQUEST",
          }),
          text: `Estimado/a ${assignedCoordinator.full_name},\n\n${roleExplanation}\n\nPuedes ingresar al portal de Gestión de Ambientes y Reservas SENA para gestionar estas solicitudes.\n\nCordialmente,\nAdministración del Sistema — SENA`,
        });
      }
    }

    const newConfig: EnvironmentsGlobalConfig = {
      tab_order: Array.isArray(currentVal.tab_order)
        ? currentVal.tab_order
        : [],
      disabled_area_ids: Array.isArray(currentVal.disabled_area_ids)
        ? currentVal.disabled_area_ids
        : [],
      disabled_special_spaces: Array.isArray(currentVal.disabled_special_spaces)
        ? currentVal.disabled_special_spaces
        : [],
      coordinators: currentCoordinators,
      updated_at: new Date().toISOString(),
      updated_by: publicUser?.full_name || "SuperAdmin",
    };

    const { error: upsertErr } = await adminSupabase
      .from("system_settings")
      .upsert(
        {
          key: "environments_global_config",
          value: newConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

    if (upsertErr) throw upsertErr;

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/admin");

    return {
      success: true,
      config: newConfig,
      assignedCoordinator,
      transferredCount,
    };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al asignar el coordinador del ambiente",
    };
  }
}
