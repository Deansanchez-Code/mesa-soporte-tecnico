"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { EmailService } from "@/lib/email/email-service";
import {
  MaintenanceCancellationNotification,
  ReservationItem,
} from "@/lib/email/templates/MaintenanceCancellationNotification";
import { SpaceMaintenanceConfig } from "../types";
import Logger from "@/lib/logger";
import { getSpaceDisplayName } from "../rules/reservationHelpers";
import {
  broadcastSpaceReenabledNotifications,
  resolveAuthenticatedPublicUser,
} from "../services/reservationAuthServer";

export async function getAllSpacesMaintenanceAction(): Promise<{
  success?: boolean;
  configs?: Record<string, SpaceMaintenanceConfig>;
  error?: string;
}> {
  try {
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["spaces_maintenance", "auditorium_maintenance"]);

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    const result: Record<string, SpaceMaintenanceConfig> = {};
    let legacyAuditorium: SpaceMaintenanceConfig | null = null;

    for (const row of data || []) {
      if (
        row.key === "spaces_maintenance" &&
        row.value &&
        typeof row.value === "object"
      ) {
        const rawMap = row.value as Record<string, SpaceMaintenanceConfig>;
        for (const [k, v] of Object.entries(rawMap)) {
          if (v && typeof v === "object") {
            result[k] = {
              ...v,
              space_id: v.space_id || k,
              space_name: v.space_name || getSpaceDisplayName(v.space_id || k),
            };
          }
        }
      }
      if (row.key === "auditorium_maintenance" && row.value) {
        legacyAuditorium = row.value as unknown as SpaceMaintenanceConfig;
      }
    }

    if (
      legacyAuditorium &&
      (!result["1"] ||
        (legacyAuditorium.is_active &&
          !result["1"].is_active &&
          (!result["1"].updated_at ||
            (legacyAuditorium.updated_at &&
              legacyAuditorium.updated_at > result["1"].updated_at))))
    ) {
      result["1"] = {
        ...legacyAuditorium,
        space_id: "1",
        space_name: "Auditorio 103",
      };
    }

    return { success: true, configs: result };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al consultar configuraciones de pausa/remodelación",
    };
  }
}

export async function saveSpaceMaintenanceAction(config: {
  is_active: boolean;
  space_id: string;
  space_name?: string;
  start_date: string;
  end_date?: string | null;
  custom_title?: string;
  custom_message?: string;
  accessToken?: string;
}) {
  try {
    const publicUser = await resolveAuthenticatedPublicUser(config.accessToken);
    if (!publicUser) throw new Error("No autenticado");

    const isAdmin = ["admin", "superadmin"].includes(
      publicUser.role?.toLowerCase() || "",
    );
    if (!isAdmin) {
      throw new Error(
        "Solo administradores pueden configurar el estado de remodelación/mantenimiento.",
      );
    }

    const adminSupabase = getSupabaseAdmin();
    const spaceTarget = config.space_id || "1";
    const resolvedSpaceName = getSpaceDisplayName(
      spaceTarget,
      config.space_name,
    );

    const { data: existingSpacesRow } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "spaces_maintenance")
      .maybeSingle();

    const currentMap: Record<string, SpaceMaintenanceConfig> =
      existingSpacesRow?.value && typeof existingSpacesRow.value === "object"
        ? {
            ...(existingSpacesRow.value as Record<
              string,
              SpaceMaintenanceConfig
            >),
          }
        : {};

    const wasPreviouslyActive = Boolean(currentMap[spaceTarget]?.is_active);
    const nowIso = new Date().toISOString();

    const cleanConfig: SpaceMaintenanceConfig = {
      is_active: Boolean(config.is_active),
      space_id: spaceTarget,
      space_name: resolvedSpaceName,
      start_date: config.start_date,
      end_date: config.end_date || null,
      custom_title:
        config.custom_title || `${resolvedSpaceName} en Remodelación`,
      custom_message: config.custom_message || "",
      reactivated_at: !config.is_active && wasPreviouslyActive ? nowIso : null,
      reactivated_message:
        !config.is_active && wasPreviouslyActive
          ? `Ya se encuentra habilitado ${resolvedSpaceName} para reservas.`
          : null,
      updated_at: nowIso,
      updated_by: publicUser.full_name || "SuperAdmin",
    };

    currentMap[spaceTarget] = cleanConfig;

    const { error: mapError } = await adminSupabase
      .from("system_settings")
      .upsert(
        {
          key: "spaces_maintenance",
          value: currentMap,
          updated_at: nowIso,
        },
        { onConflict: "key" },
      );

    if (mapError) throw mapError;

    if (spaceTarget === "1") {
      await adminSupabase.from("system_settings").upsert(
        {
          key: "auditorium_maintenance",
          value: cleanConfig,
          updated_at: nowIso,
        },
        { onConflict: "key" },
      );
    }

    let cancelledCount = 0;
    let usersNotified = 0;

    if (!cleanConfig.is_active && wasPreviouslyActive) {
      await broadcastSpaceReenabledNotifications(
        adminSupabase,
        resolvedSpaceName,
      );
    }

    if (
      cleanConfig.is_active &&
      cleanConfig.start_date &&
      ["1", "2", "3", "4", "5"].includes(spaceTarget)
    ) {
      const startDateTime = `${cleanConfig.start_date}T00:00:00-05:00`;
      const endDateTime = cleanConfig.end_date
        ? `${cleanConfig.end_date}T23:59:59-05:00`
        : "2026-12-31T23:59:59-05:00";

      const { data: activeReservations, error: fetchErr } = await adminSupabase
        .from("reservations")
        .select(
          "id, title, start_time, end_time, user_id, users(full_name, email, username)",
        )
        .eq("auditorium_id", spaceTarget)
        .in("status", ["APPROVED", "PENDING"])
        .gte("start_time", new Date(startDateTime).toISOString())
        .lte("start_time", new Date(endDateTime).toISOString())
        .order("start_time", { ascending: true });

      if (fetchErr) {
        console.error(
          "Error fetching reservations for maintenance sweep:",
          fetchErr,
        );
      } else if (activeReservations && activeReservations.length > 0) {
        cancelledCount = activeReservations.length;
        const resIds = activeReservations.map((r) => r.id);

        await adminSupabase
          .from("reservations")
          .update({ status: "CANCELLED" })
          .in("id", resIds);

        try {
          for (const res of activeReservations) {
            const { data: ticketsToCancel } = await adminSupabase
              .from("tickets")
              .select("id")
              .eq("user_id", res.user_id)
              .eq("category", "Reserva Auditorio")
              .ilike("description", `%${res.title}%`)
              .not("status", "in", '("CANCELADO","CERRADO","RESUELTO")');

            if (ticketsToCancel && ticketsToCancel.length > 0) {
              for (const t of ticketsToCancel) {
                await adminSupabase.from("ticket_events").insert({
                  ticket_id: t.id,
                  actor_id: publicUser?.id || null,
                  action_type: "STATUS_CHANGE",
                  old_value: "PENDIENTE",
                  new_value: "CANCELADO",
                  comment: `CANCELACIÓN AUTOMÁTICA: Reserva cancelada por obras de remodelación / pausa en ${resolvedSpaceName}.`,
                });

                await adminSupabase
                  .from("tickets")
                  .update({
                    status: "CANCELADO",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", t.id);
              }
            }
          }
        } catch (ticketErr) {
          console.error(
            "Error cancelling support tickets during maintenance sweep:",
            ticketErr,
          );
        }

        interface UserGroup {
          userId: string;
          userName: string;
          email: string;
          reservations: ReservationItem[];
        }

        const userGroupsMap = new Map<string, UserGroup>();

        for (const res of activeReservations) {
          const u = (
            res as unknown as {
              users: {
                full_name: string;
                email: string;
                username: string;
              } | null;
            }
          ).users;
          const uId = res.user_id;
          const userEmail =
            u?.email || `${u?.username || "usuario"}@sena.edu.co`;
          const userName = u?.full_name || "Funcionario";

          const startDateObj = new Date(res.start_time);
          const endDateObj = new Date(res.end_time);

          const dateStr = startDateObj.toLocaleDateString("es-CO", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "America/Bogota",
          });

          const timeStr = `${startDateObj.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
          })} - ${endDateObj.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
          })}`;

          const resItem: ReservationItem = {
            id: res.id,
            title: res.title,
            date: dateStr,
            timeRange: timeStr,
          };

          if (!userGroupsMap.has(uId)) {
            userGroupsMap.set(uId, {
              userId: uId,
              userName,
              email: userEmail,
              reservations: [resItem],
            });
          } else {
            userGroupsMap.get(uId)!.reservations.push(resItem);
          }
        }

        const formatHumanDate = (dStr: string) => {
          try {
            const [y, m, d] = dStr.split("-").map(Number);
            const date = new Date(y, m - 1, d);
            return date.toLocaleDateString("es-CO", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
          } catch {
            return dStr;
          }
        };

        const humanStart = formatHumanDate(cleanConfig.start_date);
        const humanEnd = cleanConfig.end_date
          ? formatHumanDate(cleanConfig.end_date)
          : null;

        for (const group of userGroupsMap.values()) {
          try {
            await adminSupabase.from("user_notifications").insert([
              {
                user_id: group.userId,
                title: "Reserva(s) Cancelada(s) por Remodelación",
                message: `Tus ${group.reservations.length} reserva(s) de ${resolvedSpaceName} a partir del ${humanStart} han sido canceladas debido a obras de remodelación física o pausa del espacio.`,
              },
            ]);

            await EmailService.send({
              to: group.email,
              subject: `⚠️ Aviso Importante: Cancelación de Reservas por Remodelación en ${resolvedSpaceName}`,
              react: MaintenanceCancellationNotification({
                userName: group.userName,
                startDate: humanStart,
                endDate: humanEnd,
                reservations: group.reservations,
                spaceName: resolvedSpaceName,
              }),
            });

            usersNotified++;
          } catch (mailErr) {
            console.error(
              `Error sending maintenance email to ${group.email}:`,
              mailErr,
            );
          }
        }

        await Logger.info(
          `Barrido de remodelación (${resolvedSpaceName}): ${cancelledCount} reservas canceladas y ${usersNotified} usuarios notificados por correo consolidado.`,
        );
      }
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return {
      success: true,
      config: cleanConfig,
      configs: currentMap,
      cancelledCount,
      usersNotified,
    };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al guardar configuración de remodelación",
    };
  }
}

export async function disableSpaceMaintenanceAction(params: {
  spaceId: string;
  spaceName?: string;
  accessToken?: string;
}) {
  try {
    const publicUser = await resolveAuthenticatedPublicUser(params.accessToken);
    if (!publicUser) throw new Error("No autenticado");

    const isAdmin = ["admin", "superadmin"].includes(
      publicUser.role?.toLowerCase() || "",
    );
    if (!isAdmin) {
      throw new Error(
        "Solo administradores pueden habilitar espacios en mantenimiento.",
      );
    }

    const adminSupabase = getSupabaseAdmin();
    const spaceTarget = params.spaceId || "1";

    const { data: existingSpacesRow } = await adminSupabase
      .from("system_settings")
      .select("value")
      .eq("key", "spaces_maintenance")
      .maybeSingle();

    const currentMap: Record<string, SpaceMaintenanceConfig> =
      existingSpacesRow?.value && typeof existingSpacesRow.value === "object"
        ? {
            ...(existingSpacesRow.value as Record<
              string,
              SpaceMaintenanceConfig
            >),
          }
        : {};

    const prevEntry = currentMap[spaceTarget];
    const resolvedSpaceName = getSpaceDisplayName(
      spaceTarget,
      params.spaceName || prevEntry?.space_name,
    );
    const nowIso = new Date().toISOString();

    const updatedEntry: SpaceMaintenanceConfig = {
      ...(prevEntry || {
        space_id: spaceTarget,
        start_date: nowIso.split("T")[0],
        end_date: null,
        custom_title: `${resolvedSpaceName} en Remodelación`,
        custom_message: "",
      }),
      is_active: false,
      space_id: spaceTarget,
      space_name: resolvedSpaceName,
      reactivated_at: nowIso,
      reactivated_message: `Ya se encuentra habilitado ${resolvedSpaceName} para realizar reservas.`,
      updated_at: nowIso,
      updated_by: publicUser.full_name || "SuperAdmin",
    };

    currentMap[spaceTarget] = updatedEntry;

    const { error: mapError } = await adminSupabase
      .from("system_settings")
      .upsert(
        {
          key: "spaces_maintenance",
          value: currentMap,
          updated_at: nowIso,
        },
        { onConflict: "key" },
      );

    if (mapError) throw mapError;

    if (spaceTarget === "1") {
      await adminSupabase.from("system_settings").upsert(
        {
          key: "auditorium_maintenance",
          value: updatedEntry,
          updated_at: nowIso,
        },
        { onConflict: "key" },
      );
    }

    await broadcastSpaceReenabledNotifications(
      adminSupabase,
      resolvedSpaceName,
    );

    await Logger.info(
      `Espacio ${resolvedSpaceName} habilitado de inmediato por ${publicUser.full_name || "Admin"}.`,
    );

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/admin");

    return {
      success: true,
      config: updatedEntry,
      configs: currentMap,
      spaceName: resolvedSpaceName,
    };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al desactivar la pausa/remodelación",
    };
  }
}
