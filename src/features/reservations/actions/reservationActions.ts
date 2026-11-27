"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EmailService } from "@/lib/email/email-service";
import { ReservationConfirmation } from "@/lib/email/templates/ReservationConfirmation";
import { SupportNotification } from "@/lib/email/templates/SupportNotification";
import { VipCancellation } from "@/lib/email/templates/VipCancellation";
import { LibraryNotification } from "@/lib/email/templates/LibraryNotification";
import { SpaceReservationEmail } from "@/lib/email/templates/SpaceReservationEmail";
import { ReservationSchema } from "../schemas";
import { EnvironmentsGlobalConfig, SpaceMaintenanceConfig } from "../types";
import { getSpaceCoordinator } from "./spaceConfigActions";
import Logger from "@/lib/logger";
import { buildUserIdOrFilter, isValidUuid } from "@/lib/security";
import {
  canAccessNextVigencia,
  getBogotaDateString,
  getVisibleSpaceIdsForUser,
  hasCrossSpaceOverlap,
  isDateBeyondCurrentVigencia,
} from "../rules/reservationRules";
import {
  getSpaceDisplayName,
  hasValidDescription,
  isAmbiente107ApproverIdentity,
  isCoordinatorPrivilegeUsername,
  isLibraryStaffEmail,
  resolveReservationUserEmail,
} from "../rules/reservationHelpers";
import {
  getTimeBlockBounds,
  mapAreaNameToSpaceId,
} from "../rules/legacyAssignmentsAdapter";

async function hasLegacyAssignmentConflict(
  supabaseClient: Awaited<ReturnType<typeof createClient>>,
  targetSpaceId: string,
  startIso: string,
  endIso: string,
): Promise<boolean> {
  try {
    const { data: areasData } = await supabaseClient
      .from("areas")
      .select("id, name");
    const matchingAreaIds = (areasData || [])
      .filter((a) => mapAreaNameToSpaceId(a.name) === String(targetSpaceId))
      .map((a) => a.id);

    if (matchingAreaIds.length === 0) return false;

    const bogotaDate = getBogotaDateString(new Date(startIso));
    const { data: assignRows } = await supabaseClient
      .from("instructor_assignments")
      .select("id, area_id, assignment_date, time_block")
      .in("area_id", matchingAreaIds)
      .eq("assignment_date", bogotaDate);

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    return (assignRows || []).some((row) => {
      const bounds = getTimeBlockBounds(row.assignment_date, row.time_block);
      const bStart = new Date(bounds.startIso).getTime();
      const bEnd = new Date(bounds.endIso).getTime();
      return startMs < bEnd && endMs > bStart;
    });
  } catch {
    return false;
  }
}

export async function cancelReservationAction(
  reservationId: number,
  options: { silent?: boolean } = {},
) {
  const { silent = false } = options;

  try {
    const supabase = await createClient();

    // 1. Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // 2. Fetch reservation to check ownership
    const { data: reservation } = await supabase
      .from("reservations")
      .select("user_id, start_time, title")
      .eq("id", reservationId)
      .single();

    if (!reservation) throw new Error("Reserva no encontrada");

    // 3. Get public profile for VIP/Role check
    const { data: publicUser } = await supabase
      .from("users")
      .select("id, is_vip, role, full_name")
      .eq("auth_id", user.id)
      .single();

    const isOwner = publicUser?.id === reservation.user_id;
    const isVip =
      !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";
    const isAdmin = ["admin", "superadmin"].includes(
      publicUser?.role?.toLowerCase() || "",
    );

    if (!isOwner && !isVip && !isAdmin) {
      throw new Error("No tienes permisos para cancelar esta reserva");
    }

    // 4. Past event check
    const startTime = new Date(reservation.start_time);
    if (new Date() >= startTime && !isAdmin) {
      throw new Error("No se pueden cancelar eventos en curso o finalizados.");
    }

    // 5. Cancel
    const { error } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", reservationId);

    if (error) throw new Error(error.message);

    // --- EMAIL NOTIFICATIONS ---
    try {
      const dateStr = new Date(reservation.start_time).toLocaleDateString(
        "es-CO",
        { timeZone: "America/Bogota" },
      );

      // A. Notify Owner if VIP Override
      if (!isOwner && isVip) {
        // Insert internal notification
        await supabase.from("user_notifications").insert([
          {
            user_id: reservation.user_id,
            title: "Reserva Cancelada por Prioridad",
            message: `Tu reserva "${reservation.title}" para el ${new Date(reservation.start_time).toLocaleString("es-CO", { timeZone: "America/Bogota" })} ha sido cancelada por un usuario VIP.`,
          },
        ]);

        const { data: victim } = await supabase
          .from("users")
          .select("full_name, email, employment_type, job_category, username")
          .eq("id", reservation.user_id)
          .single();

        if (victim) {
          const victimEmail = resolveReservationUserEmail(victim);

          if (victimEmail && victimEmail.includes("@") && !silent) {
            await EmailService.send({
              to: victimEmail,
              subject: `⚠️ Cancelación por Prioridad: ${reservation.title}`,
              react: VipCancellation({
                userName: victim.full_name,
                eventTitle: reservation.title,
                date: dateStr,
                cancelledBy: publicUser?.full_name || "Usuario VIP",
              }),
            });
          }
        }
      }

      // B. Notify Coordinator IF it had Special Requirements (Always trigger on cancellation)
      const { data: resDetails } = await supabase
        .from("reservations")
        .select("description, auditorium_id, users(full_name)")
        .eq("id", reservationId)
        .single();

      if (hasValidDescription(resDetails?.description) && !silent) {
        const userDetails = resDetails?.users as unknown as {
          full_name: string;
        } | null;
        const targetCoord = await getSpaceCoordinator(
          (resDetails as { auditorium_id?: string | number })?.auditorium_id ||
            "1",
        );
        await EmailService.send({
          to: targetCoord.email || "jeavendano@sena.edu.co",
          subject: `🚫 Requerimiento Cancelado: ${reservation.title}`,
          react: SupportNotification({
            requesterName: userDetails?.full_name || "Usuario",
            eventTitle: reservation.title,
            date: dateStr,
            timeRange: "CANCELADO",
            specialRequirements: resDetails!.description!,
            type: "CANCELLED_REQUIREMENT",
            cancelledBy: isOwner
              ? "El Usuario (Cancelación Manual)"
              : publicUser?.full_name || "Administración",
          }),
        });
      }
    } catch (e) {
      console.error("Cancellation Email Error: ", e);
    }
    // --- AUTOMATIC TICKET CANCELLATION (soft update, no hard delete) ---
    try {
      const adminSupabase = getSupabaseAdmin();

      // Identify the associated ticket(s)
      // We look for tickets from the reservation owner, in the "Reserva Auditorio" category,
      // and whose description contains the reservation title.
      // Use Admin Client to bypass potential RLS restrictions on ticket status updates by contractors.
      const { data: tickets } = await adminSupabase
        .from("tickets")
        .select("id, description")
        .eq("user_id", reservation.user_id)
        .eq("category", "Reserva Auditorio")
        .ilike("description", `%${reservation.title}%`)
        .not("status", "in", '("CANCELADO","CERRADO","RESUELTO")')
        .order("created_at", { ascending: false });

      if (tickets && tickets.length > 0) {
        for (const ticket of tickets) {
          const ticketId = ticket.id;
          const cancelNote = isOwner
            ? "Cancelado por el usuario"
            : `Cancelado por administrador (${publicUser?.full_name || "Administración"})`;

          // 1. Insertar el evento de cambio de estado en ticket_events
          const { error: eventError } = await adminSupabase
            .from("ticket_events")
            .insert({
              ticket_id: ticketId,
              actor_id: publicUser?.id || null,
              action_type: "STATUS_CHANGE",
              old_value: "PENDIENTE", // O el estado previo del ticket, asumimos que no estaba cancelado
              new_value: "CANCELADO",
              comment: `CANCELACIÓN AUTOMÁTICA: ${cancelNote}.`,
            });

          if (eventError) {
            console.error(
              "Error creating ticket cancellation event:",
              eventError,
            );
          }

          // 2. Actualizar el estado del ticket sin modificar description
          const { error: updateError } = await adminSupabase
            .from("tickets")
            .update({
              status: "CANCELADO",
              updated_at: new Date().toISOString(),
            })
            .eq("id", ticketId);

          if (!updateError) {
            await Logger.info(
              `Ticket #${ticketId} marcado como CANCELADO automáticamente (vía Admin) tras cancelación de reserva #${reservationId}.`,
            );
          } else {
            console.error("Error updating ticket status:", updateError);
          }
        }
      }
    } catch (e) {
      console.error("Auto Ticket Cancellation Error: ", e);
      await Logger.error("Error en cancelación automática de ticket", {
        reservationId,
        error: e,
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Error al cancelar la reserva";
    await Logger.error(`Reservation Cancellation Failed: ${errorMsg}`, {
      reservationId,
      error,
    });
    return { error: errorMsg };
  }
}

export async function confirmReservationAction(reservationId: number) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: reservation } = await supabase
      .from("reservations")
      .select("user_id, title")
      .eq("id", reservationId)
      .single();

    if (!reservation) throw new Error("Reserva no encontrada");

    const { data: publicUser } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .single();

    const isOwner = publicUser?.id === reservation.user_id;
    const isAdmin = ["admin", "superadmin"].includes(
      publicUser?.role?.toLowerCase() || "",
    );

    if (!isOwner && !isAdmin) {
      throw new Error(
        "Solo el titular de la reserva puede confirmar su asistencia.",
      );
    }

    const { error } = await supabase
      .from("reservations")
      .update({ status: "CONFIRMED" })
      .eq("id", reservationId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al confirmar la reserva";
    return { success: false, error: message };
  }
}

interface PublicUser {
  id: string;
  role: string | null;
  employment_type: string | null;
  email: string | null;
  username: string;
  is_vip?: boolean | null;
  job_category?: string | null;
  area?: string | null;
  perm_manage_assignments?: boolean | null;
}

export async function createReservationAction(
  data: z.infer<typeof ReservationSchema>,
) {
  try {
    const parseResult = ReservationSchema.safeParse(data);
    if (!parseResult.success) {
      throw new Error(
        "Datos inválidos: " + JSON.stringify(parseResult.error.format()),
      );
    }

    const {
      title,
      start_time,
      end_time,
      user_id,
      auditorium_id,
      resources,
      description,
    } = parseResult.data;
    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    // 2. Permissions & Identity Check
    const { data: publicUserRaw } = await supabase
      .from("users")
      .select(
        "id, role, employment_type, email, username, job_category, is_vip, area, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const publicUser = publicUserRaw as unknown as PublicUser;
    const cleanUsername = (publicUser?.username || "").toLowerCase().trim();
    const isCoordinator =
      !!publicUser?.perm_manage_assignments ||
      publicUser?.job_category?.toLowerCase() === "coordinador" ||
      publicUser?.role?.toLowerCase() === "coordinator" ||
      isCoordinatorPrivilegeUsername(cleanUsername);

    if (publicUser?.id !== user_id && authUser.id !== user_id) {
      const isAdmin = ["admin", "superadmin"].includes(
        publicUser?.role?.toLowerCase() || "",
      );
      const isVipUser =
        !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";
      if (!isAdmin && !isCoordinator && !isVipUser)
        throw new Error(
          "No tienes permisos para crear reservas a nombre de otros",
        );
    }

    // 0. Validación de Tiempo Pasado: No se pueden realizar reservas en tiempo pasado
    const now = new Date();
    const fiveMinutesBuffer = new Date(now.getTime() - 5 * 60 * 1000);
    const reservationStart = new Date(start_time);
    if (reservationStart < fiveMinutesBuffer) {
      throw new Error(
        "No es posible realizar reservas en fechas u horarios del pasado. Por favor selecciona un horario futuro.",
      );
    }

    // Validación de Fines de Semana para Funcionarios Normales
    const isVip =
      !!publicUser?.is_vip ||
      publicUser?.role?.toLowerCase() === "vip" ||
      isCoordinator;
    const isAdmin = ["admin", "superadmin"].includes(
      publicUser?.role?.toLowerCase() || "",
    );
    const isInstructor =
      publicUser?.job_category?.toLowerCase() === "instructor" ||
      publicUser?.role?.toLowerCase() === "instructor";

    if (!isAdmin && !isVip && !isInstructor) {
      // Es un funcionario normal (u otro rol). Revisar si es fin de semana.
      // Evaluamos en la zona horaria local de Colombia para evitar que el viernes en la noche
      // sea tratado como sábado (UTC) en el servidor.
      const reservationStart = new Date(start_time);
      const bogotaDateString = reservationStart.toLocaleString("en-US", {
        timeZone: "America/Bogota",
      });
      const bogotaDate = new Date(bogotaDateString);
      const dayOfWeek = bogotaDate.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        throw new Error(
          "Los funcionarios no pueden reservar el auditorio los fines de semana. Por favor, solicite autorización enviando un correo electrónico a la coordinadora administrativa Lorena Gutierrez.",
        );
      }
    }

    // Validación de Remodelación / Mantenimiento (Multi-espacio)
    const targetSpaceForMaintenance = auditorium_id || "1";
    // 2.5. Bloqueo absoluto si el espacio está en Pausa / Remodelación o Deshabilitado (aplica a todos los roles hasta habilitar)
    {
      const { data: globalSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "environments_global_config")
        .maybeSingle();

      const globalCfg = globalSetting?.value as
        | EnvironmentsGlobalConfig
        | undefined;
      if (
        Array.isArray(globalCfg?.disabled_special_spaces) &&
        globalCfg.disabled_special_spaces
          .map(String)
          .includes(String(targetSpaceForMaintenance))
      ) {
        const spaceName = getSpaceDisplayName(targetSpaceForMaintenance);
        throw new Error(
          `${spaceName} se encuentra temporalmente deshabilitado. No es posible realizar reservas de ningún tipo hasta que sea habilitado de nuevo.`,
        );
      }

      let mConfig: SpaceMaintenanceConfig | null = null;
      const { data: spacesSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "spaces_maintenance")
        .maybeSingle();

      if (spacesSetting?.value && typeof spacesSetting.value === "object") {
        const map = spacesSetting.value as Record<
          string,
          SpaceMaintenanceConfig
        >;
        if (map[targetSpaceForMaintenance]) {
          mConfig = map[targetSpaceForMaintenance];
        }
      }

      if (!mConfig && targetSpaceForMaintenance === "1") {
        const { data: mSetting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "auditorium_maintenance")
          .maybeSingle();
        if (mSetting?.value) {
          mConfig = mSetting.value as unknown as SpaceMaintenanceConfig;
        }
      }

      if (mConfig?.is_active) {
        const endMsg = mConfig.end_date
          ? `hasta el ${mConfig.end_date}`
          : "hasta nuevo aviso";
        const spaceName =
          mConfig.space_name || getSpaceDisplayName(targetSpaceForMaintenance);
        throw new Error(
          `${spaceName} se encuentra fuera de servicio por pausa/remodelación (${endMsg}). No se pueden realizar reservas de ningún tipo hasta que sea habilitado nuevamente.`,
        );
      }
    }

    // 3. Conflict Check (Scoped to specific space)
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .in("status", ["APPROVED", "PENDING"])
      .eq("auditorium_id", auditorium_id || "1")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      throw new Error(
        "Horario no disponible (conflicto detectado en este espacio)",
      );
    }

    if (
      await hasLegacyAssignmentConflict(
        supabase,
        String(auditorium_id || "1"),
        start_time,
        end_time,
      )
    ) {
      throw new Error(
        "Horario no disponible (existe una asignación de formación registrada en este ambiente)",
      );
    }

    // 3.5 Reglas de visibilidad por rol, vigencia anual y bloqueo anti-multireserva simultánea
    const currentSpace = auditorium_id || "1";
    const visibleSpaces = getVisibleSpaceIdsForUser({
      role: publicUser?.role,
      employment_type: publicUser?.employment_type,
      job_category: publicUser?.job_category,
      is_vip: publicUser?.is_vip,
      perm_manage_assignments: publicUser?.perm_manage_assignments,
    });
    if (!visibleSpaces.includes(String(currentSpace))) {
      throw new Error(
        "No tienes permisos para reservar el ambiente seleccionado.",
      );
    }

    const userCanNextVigencia = canAccessNextVigencia({
      role: publicUser?.role,
      employment_type: publicUser?.employment_type,
      job_category: publicUser?.job_category,
      is_vip: publicUser?.is_vip,
      perm_manage_assignments: publicUser?.perm_manage_assignments,
    });
    if (!userCanNextVigencia && isDateBeyondCurrentVigencia(start_time)) {
      throw new Error("Fecha no disponible para reserva en esta vigencia.");
    }

    // Evitar multi-reservas simultáneas del mismo usuario en diferentes ambientes
    const ownerLookupId = publicUser?.id || user_id;
    const { data: userConcurrentRows } = await supabase
      .from("reservations")
      .select("id, auditorium_id, start_time, end_time, status, user_id")
      .in("status", ["APPROVED", "PENDING"])
      .eq("user_id", ownerLookupId)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (
      userConcurrentRows &&
      hasCrossSpaceOverlap(
        userConcurrentRows,
        String(currentSpace),
        start_time,
        end_time,
      )
    ) {
      throw new Error(
        "No puedes tener reservas simultáneas en diferentes ambientes en el mismo horario.",
      );
    }

    // 4. RBAC Check for Subdirección (ID 2) and Biblioteca (ID 3)
    let initialStatus = "APPROVED";
    let needsApproval = false;

    if (currentSpace === "2") {
      const employmentType = (publicUser?.employment_type || "").toLowerCase();
      const isOfficial =
        employmentType.includes("planta") ||
        employmentType.includes("funcionario") ||
        employmentType.includes("oficial");
      const isAdmin = ["admin", "superadmin"].includes(
        publicUser?.role?.toLowerCase() || "",
      );

      if (!isOfficial && !isAdmin) {
        throw new Error(
          "Solo el personal de planta o administradores pueden reservar la Subdirección de Centro.",
        );
      }
    } else if (currentSpace === "3") {
      const userEmail = (publicUser?.email || "").toLowerCase();
      const isAdmin = ["admin", "superadmin"].includes(
        publicUser?.role?.toLowerCase() || "",
      );
      const isVip =
        !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";
      const isInstructor =
        publicUser?.job_category?.toLowerCase() === "instructor";
      const isPlanta = publicUser?.employment_type
        ?.toLowerCase()
        .includes("planta");

      const isStaff = isLibraryStaffEmail(userEmail);

      if (!isStaff && !isAdmin && !isVip && !isInstructor && !isPlanta) {
        throw new Error(
          "No tienes permisos para realizar esta reserva en Biblioteca.",
        );
      }

      // Business Rule: Instructors and Planta need approval, VIPs/Admins/Staff are approved immediately
      if ((isInstructor || isPlanta) && !isVip && !isAdmin && !isStaff) {
        initialStatus = "PENDING";
        needsApproval = true;
      }
    } else if (currentSpace === "4" || currentSpace === "5") {
      // Regla de Negocio: Ambiente 107 (ID 4) y Ambiente de Cocina (ID 5) (Coordinadora: Nury Mildret Barrera nbarrerac@sena.edu.co)
      const spaceLabel =
        currentSpace === "5" ? "Ambiente de Cocina" : "Ambiente 107";
      const userEmail = (publicUser?.email || "").toLowerCase();
      const isAdmin = ["admin", "superadmin"].includes(
        publicUser?.role?.toLowerCase() || "",
      );
      const isVip =
        !!publicUser?.is_vip ||
        publicUser?.role?.toLowerCase() === "vip" ||
        isCoordinator;
      const isInstructor =
        (publicUser?.job_category || "").toLowerCase().includes("instructor") ||
        (publicUser?.role || "").toLowerCase().includes("instructor") ||
        (publicUser?.area || "").toLowerCase().includes("instructor") ||
        (publicUser?.employment_type || "")
          .toLowerCase()
          .includes("instructor");
      const isPlanta = publicUser?.employment_type
        ?.toLowerCase()
        .includes("planta");

      const isStaff107 =
        isAmbiente107ApproverIdentity(cleanUsername, userEmail) ||
        isCoordinator;

      if (!isStaff107 && !isAdmin && !isVip && !isInstructor && !isPlanta) {
        throw new Error(
          `No tienes permisos para realizar reservas en el ${spaceLabel}.`,
        );
      }

      // Regla de Negocio: Ambiente 107 y Cocina requieren autorización expresa de Nury Mildret Barrera (nbarrerac@sena.edu.co)
      if ((isInstructor || isPlanta) && !isVip && !isAdmin && !isStaff107) {
        initialStatus = "PENDING";
        needsApproval = true;
      } else {
        initialStatus = "APPROVED";
        needsApproval = false;
      }
    }

    // 5. Insert (use adminSupabase so assigned user_id is always respected and joined properly)
    const adminSupabase = getSupabaseAdmin();
    const { data: targetOwner } = isValidUuid(user_id)
      ? await adminSupabase
          .from("users")
          .select("id")
          .or(buildUserIdOrFilter(user_id))
          .maybeSingle()
      : { data: null };
    const resolvedOwnerId = targetOwner?.id || user_id;

    const { data: result, error } = await adminSupabase
      .from("reservations")
      .insert([
        {
          title,
          start_time,
          end_time,
          user_id: resolvedOwnerId,
          auditorium_id: auditorium_id || "1",
          resources,
          description,
          status: initialStatus,
        },
      ])
      .select(
        "*, users(full_name, email, employment_type, job_category, username)",
      )
      .single();

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    // --- NOTIFICATION LOGIC ---
    try {
      const reservation = result;
      const user = reservation.users;
      const recipientEmail = resolveReservationUserEmail(user);
      const isLibrary = String(reservation.auditorium_id) === "3";
      const isAmbiente107 = String(reservation.auditorium_id) === "4";
      const isCocina = String(reservation.auditorium_id) === "5";

      const startDate = new Date(reservation.start_time);
      const endDate = new Date(reservation.end_time);
      const dateStr = startDate.toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/Bogota",
      });
      const timeStr = `${startDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })} - ${endDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}`;
      const durationHours =
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      // Business Rule: Notifications for Ambiente 107 & Cocina go to active coordinator AND to the reservation owner
      if (isAmbiente107 || isCocina) {
        const spaceLabel = isCocina ? "Ambiente de Cocina" : "Ambiente 107";
        const coordinator = await getSpaceCoordinator(isCocina ? "5" : "4");

        const coordinatorSubject =
          reservation.status === "PENDING"
            ? `Solicitud de Prereserva ${spaceLabel}: ${reservation.title}`
            : `Reserva VIP Aprobada (${spaceLabel}): ${reservation.title}`;

        if (
          reservation.status === "PENDING" ||
          recipientEmail.toLowerCase() !== coordinator.email.toLowerCase()
        ) {
          await EmailService.send({
            to: coordinator.email,
            subject: coordinatorSubject,
            react: SpaceReservationEmail({
              spaceName: spaceLabel,
              requesterName: user.full_name,
              eventTitle: reservation.title,
              date: dateStr,
              timeRange: `${timeStr} (${durationHours.toFixed(1)} horas)`,
              specialRequirements: reservation.description || "Ninguno",
              coordinatorName: coordinator.full_name,
              type:
                reservation.status === "PENDING"
                  ? "NEW_REQUEST"
                  : "VIP_AUTOMATIC",
            }),
          });
        }

        if (reservation.status === "PENDING") {
          // Enviar constancia de prerreserva al funcionario/instructor que queda con la reserva
          if (recipientEmail && recipientEmail.includes("@")) {
            await EmailService.send({
              to: recipientEmail,
              subject: `Solicitud de Prereserva Recibida (${spaceLabel}): ${reservation.title}`,
              react: SpaceReservationEmail({
                spaceName: spaceLabel,
                requesterName: user.full_name,
                eventTitle: reservation.title,
                date: dateStr,
                timeRange: `${timeStr} (${durationHours.toFixed(1)} horas)`,
                specialRequirements: reservation.description || "Ninguno",
                coordinatorName: coordinator.full_name,
                type: "NEW_REQUEST",
              }),
            });
          }

          await adminSupabase.from("user_notifications").insert([
            {
              user_id: resolvedOwnerId,
              title: `Prereserva en revisión (${spaceLabel}) ⏳`,
              message: `Tu solicitud "${reservation.title}" para el ${dateStr} fue enviada a coordinación para autorización.`,
            },
          ]);

          revalidatePath("/dashboard");
          return { success: true, data: result, pendingApproval: true };
        }
      }

      // Business Rule: Notifications for Library go to active coordinator AND to the reservation owner
      if (isLibrary) {
        const libraryCoord = await getSpaceCoordinator("3");
        const coordinatorSubject =
          reservation.status === "PENDING"
            ? `Solicitud de Reserva Biblioteca: ${reservation.title}`
            : `Reserva VIP Aprobada (Cuentadante): ${reservation.title}`;

        if (
          reservation.status === "PENDING" ||
          recipientEmail.toLowerCase() !== libraryCoord.email.toLowerCase()
        ) {
          await EmailService.send({
            to: libraryCoord.email,
            subject: coordinatorSubject,
            react: LibraryNotification({
              requesterName: user.full_name,
              eventTitle: reservation.title,
              date: dateStr,
              timeRange: `${timeStr} (${durationHours.toFixed(1)} horas)`,
              specialRequirements: reservation.description || "Ninguno",
              type:
                reservation.status === "PENDING"
                  ? "NEW_REQUEST"
                  : "VIP_AUTOMATIC",
            }),
          });
        }

        if (reservation.status === "PENDING") {
          if (recipientEmail && recipientEmail.includes("@")) {
            await EmailService.send({
              to: recipientEmail,
              subject: `Solicitud de Prereserva Recibida (Biblioteca): ${reservation.title}`,
              react: SpaceReservationEmail({
                spaceName: "Biblioteca",
                requesterName: user.full_name,
                eventTitle: reservation.title,
                date: dateStr,
                timeRange: `${timeStr} (${durationHours.toFixed(1)} horas)`,
                specialRequirements: reservation.description || "Ninguno",
                coordinatorName: libraryCoord.full_name,
                type: "NEW_REQUEST",
              }),
            });
          }

          await adminSupabase.from("user_notifications").insert([
            {
              user_id: resolvedOwnerId,
              title: "Prereserva en revisión (Biblioteca) ⏳",
              message: `Tu solicitud "${reservation.title}" para el ${dateStr} fue enviada a Biblioteca para autorización.`,
            },
          ]);

          revalidatePath("/dashboard");
          return { success: true, data: result, pendingApproval: true };
        }
      }

      // Confirmación al funcionario/instructor titular de la reserva (cuando ya está APPROVED)
      if (recipientEmail && recipientEmail.includes("@")) {
        await EmailService.send({
          to: recipientEmail,
          subject: `Reserva Confirmada: ${reservation.title}`,
          react: ReservationConfirmation({
            userName: user.full_name,
            eventTitle: reservation.title,
            date: dateStr,
            timeRange: timeStr,
            location: getSpaceDisplayName(reservation.auditorium_id),
            resources: reservation.resources || [],
            specialRequirements: reservation.description,
          }),
        });
        if (hasValidDescription(reservation.description) && !isLibrary) {
          const targetCoord = await getSpaceCoordinator(
            reservation.auditorium_id || "1",
          );
          await EmailService.send({
            to: targetCoord.email || "jeavendano@sena.edu.co",
            subject: `⚠️ Nuevo Requerimiento Especial (${getSpaceDisplayName(reservation.auditorium_id)}): ${reservation.title}`,
            react: SupportNotification({
              requesterName: user.full_name,
              requesterEmail: recipientEmail,
              eventTitle: reservation.title,
              date: dateStr,
              timeRange: timeStr,
              specialRequirements: reservation.description!,
              type: "NEW_REQUIREMENT",
            }),
          });
        }
      }
    } catch (emailErr) {
      console.error("Single Reservation Email Error:", emailErr);
    }

    revalidatePath("/dashboard");
    return { success: true, data: result, pendingApproval: needsApproval };
  } catch (error: unknown) {
    const errorMsg =
      (error as Record<string, unknown>)?.message ||
      (typeof error === "object"
        ? JSON.stringify(error)
        : String(error || "Error al crear reserva"));
    await Logger.error(`Reservation Creation Failed: ${errorMsg}`, { error });
    return { error: String(errorMsg) };
  }
}

export async function updateReservationAction(
  data: z.infer<typeof ReservationSchema>,
) {
  try {
    const parseResult = ReservationSchema.safeParse(data);
    if (!parseResult.success) {
      throw new Error("Datos inválidos");
    }

    const {
      id,
      title,
      start_time,
      end_time,
      user_id,
      auditorium_id,
      resources,
      description,
    } = parseResult.data;
    if (!id) throw new Error("ID de reserva requerido para actualizar");

    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    // 2. Fetch Existing & Check Permissions
    const { data: existing } = await supabase
      .from("reservations")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing) throw new Error("Reserva no encontrada");

    const { data: publicUser } = await supabase
      .from("users")
      .select(
        "id, is_vip, role, employment_type, email, username, job_category, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const cleanUsername = (publicUser?.username || "").toLowerCase().trim();
    const isCoordinator =
      !!publicUser?.perm_manage_assignments ||
      publicUser?.job_category?.toLowerCase() === "coordinador" ||
      publicUser?.role?.toLowerCase() === "coordinator" ||
      isCoordinatorPrivilegeUsername(cleanUsername);

    const isOwner = publicUser?.id === existing.user_id;
    const isVip =
      !!publicUser?.is_vip ||
      publicUser?.role?.toLowerCase() === "vip" ||
      isCoordinator;
    const isAdmin = ["admin", "superadmin"].includes(
      publicUser?.role?.toLowerCase() || "",
    );

    if (!isOwner && !isVip && !isAdmin) {
      throw new Error("No tienes permisos para modificar esta reserva");
    }

    // 3. Conflict Check (excluding current ID, scoped to space)
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .in("status", ["APPROVED", "PENDING"])
      .eq("auditorium_id", auditorium_id || "1")
      .neq("id", id)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      throw new Error(
        "Horario no disponible (conflicto detectado en este espacio)",
      );
    }

    if (
      await hasLegacyAssignmentConflict(
        supabase,
        String(auditorium_id || "1"),
        start_time,
        end_time,
      )
    ) {
      throw new Error(
        "Horario no disponible (existe una asignación de formación registrada en este ambiente)",
      );
    }

    // 4. RBAC Check for Subdirección (ID 2) and Biblioteca (ID 3)
    const currentSpace = auditorium_id || "1";
    if (currentSpace === "2") {
      if (!isVip && !isAdmin) {
        throw new Error(
          "Solo el personal VIP o administradores pueden reservar la Subdirección de Centro.",
        );
      }
    } else if (currentSpace === "3") {
      const userEmail = (publicUser?.email || "").toLowerCase();
      const isAllowed = isLibraryStaffEmail(userEmail);

      if (!isAllowed && !isAdmin && !isVip) {
        throw new Error(
          "Solo los encargados de Biblioteca, coordinadores o administradores pueden realizar esta reserva.",
        );
      }
    }

    // 5. Update (use adminSupabase so Coordinators/VIPs can edit & reassign any instructor's reservation without RLS blocking)
    const adminSupabase = getSupabaseAdmin();
    const { data: targetOwner } = isValidUuid(user_id)
      ? await adminSupabase
          .from("users")
          .select(
            "id, full_name, email, employment_type, job_category, username",
          )
          .or(buildUserIdOrFilter(user_id))
          .maybeSingle()
      : { data: null };

    const resolvedOwnerId = targetOwner?.id || user_id || existing.user_id;

    const { data: result, error } = await adminSupabase
      .from("reservations")
      .update({
        title,
        start_time,
        end_time,
        user_id: resolvedOwnerId,
        auditorium_id: auditorium_id || "1",
        resources,
        description,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    // 6. Enviar correo de actualización al funcionario/instructor que queda con la reserva
    try {
      if (targetOwner) {
        const recipientEmail = resolveReservationUserEmail(targetOwner);
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);
        const dateStr = startDate.toLocaleDateString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "America/Bogota",
        });
        const timeStr = `${startDate.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Bogota",
        })} - ${endDate.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Bogota",
        })}`;
        const spaceLabel = getSpaceDisplayName(auditorium_id);

        if (recipientEmail && recipientEmail.includes("@")) {
          await EmailService.send({
            to: recipientEmail,
            subject: `Actualización de Reserva (${spaceLabel}): ${title}`,
            react: ReservationConfirmation({
              userName: targetOwner.full_name,
              eventTitle: `${title} (Actualizada)`,
              date: dateStr,
              timeRange: timeStr,
              location: spaceLabel,
              resources: resources || [],
              specialRequirements: description,
            }),
          });
        }

        await adminSupabase.from("user_notifications").insert([
          {
            user_id: resolvedOwnerId,
            title: "Reserva Actualizada 📅",
            message: `Tu reserva "${title}" en ${spaceLabel} para el ${dateStr} (${timeStr}) ha sido actualizada.`,
          },
        ]);
      }
    } catch (emailErr) {
      console.error("Update Reservation Email Error:", emailErr);
    }

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    const errorMsg =
      (error as Record<string, unknown>)?.message ||
      (typeof error === "object"
        ? JSON.stringify(error)
        : String(error || "Error al actualizar reserva"));
    await Logger.error(`Reservation Update Failed: ${errorMsg}`, { error });
    return { error: String(errorMsg) };
  }
}

export async function createReservationBatchAction(
  reservations: z.infer<typeof ReservationSchema>[],
  forceVipOverride: boolean = false,
) {
  try {
    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    // 2. Permissions & VIP Check
    const { data: publicUserRaw, error: userError } = await supabase
      .from("users")
      .select(
        "id, role, is_vip, full_name, employment_type, email, job_category, username, area, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    if (userError || !publicUserRaw)
      throw new Error("Usuario no encontrado en base de datos");

    const publicUser = publicUserRaw as unknown as PublicUser;
    const cleanUsername = (publicUser.username || "").toLowerCase().trim();
    const isCoordinator =
      !!publicUser.perm_manage_assignments ||
      publicUser.job_category?.toLowerCase() === "coordinador" ||
      publicUser.role?.toLowerCase() === "coordinator" ||
      isCoordinatorPrivilegeUsername(cleanUsername);

    const isVip =
      !!publicUser.is_vip ||
      publicUser.role?.toLowerCase() === "vip" ||
      isCoordinator;
    const isAdmin = ["admin", "superadmin"].includes(
      publicUser.role?.toLowerCase() || "",
    );
    const isInstructor =
      publicUser?.job_category?.toLowerCase() === "instructor" ||
      publicUser?.role?.toLowerCase() === "instructor";

    // Precargar configuración global y de mantenimiento una sola vez por lote (evita N+1 en reservas recurrentes)
    const { data: batchSettingsRows } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "environments_global_config",
        "spaces_maintenance",
        "auditorium_maintenance",
      ]);

    const settingsByKey = new Map<string, unknown>(
      (batchSettingsRows || []).map((row) => [row.key, row.value]),
    );
    const globalCfg = settingsByKey.get("environments_global_config") as
      | EnvironmentsGlobalConfig
      | undefined;
    const disabledSpacesSet = new Set(
      Array.isArray(globalCfg?.disabled_special_spaces)
        ? globalCfg.disabled_special_spaces.map(String)
        : [],
    );
    const spacesMaintenanceRaw = settingsByKey.get("spaces_maintenance");
    const spacesMaintenanceMap =
      spacesMaintenanceRaw && typeof spacesMaintenanceRaw === "object"
        ? (spacesMaintenanceRaw as Record<string, SpaceMaintenanceConfig>)
        : {};
    const legacyAudMaintenance = settingsByKey.get("auditorium_maintenance") as
      | SpaceMaintenanceConfig
      | undefined;

    // Pre-validate all
    const validReservations = [];
    for (const res of reservations) {
      const parseResult = ReservationSchema.safeParse(res);
      if (!parseResult.success) {
        throw new Error(
          "Datos inválidos en una de las reservas: " +
            JSON.stringify(parseResult.error.format()),
        );
      }
      const data = parseResult.data;

      // Identity check & Resolve target user_id
      if (publicUser.id !== data.user_id && authUser.id !== data.user_id) {
        if (!isAdmin && !isCoordinator && !isVip)
          throw new Error(
            "No tienes permisos para crear reservas a nombre de otros",
          );
      } else if (
        authUser.id === data.user_id &&
        publicUser.id !== authUser.id
      ) {
        // Si el cliente envió el auth_id por sesión cacheada, normalizar al id público de users
        data.user_id = publicUser.id;
      }

      // Validación Fines de Semana
      if (!isAdmin && !isVip && !isInstructor) {
        const reservationStart = new Date(data.start_time);
        const bogotaDateString = reservationStart.toLocaleString("en-US", {
          timeZone: "America/Bogota",
        });
        const bogotaDate = new Date(bogotaDateString);
        const dayOfWeek = bogotaDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          throw new Error(
            "Los funcionarios no pueden reservar el auditorio los fines de semana. Por favor, solicite autorización enviando un correo electrónico a la coordinadora administrativa Lorena Gutierrez.",
          );
        }
      }

      // Validación estricta de Remodelación / Pausa / Deshabilitación (aplica a todos los roles hasta habilitar)
      const targetSpaceForMaintenance = String(data.auditorium_id || "1");
      if (disabledSpacesSet.has(targetSpaceForMaintenance)) {
        const spaceName = getSpaceDisplayName(targetSpaceForMaintenance);
        throw new Error(
          `${spaceName} se encuentra temporalmente deshabilitado. No es posible realizar reservas de ningún tipo hasta que sea habilitado de nuevo.`,
        );
      }

      const mConfig: SpaceMaintenanceConfig | null =
        spacesMaintenanceMap[targetSpaceForMaintenance] ||
        (targetSpaceForMaintenance === "1"
          ? legacyAudMaintenance || null
          : null);

      if (mConfig?.is_active) {
        const endMsg = mConfig.end_date
          ? `hasta el ${mConfig.end_date}`
          : "hasta nuevo aviso";
        const spaceName =
          mConfig.space_name || getSpaceDisplayName(targetSpaceForMaintenance);
        throw new Error(
          `${spaceName} se encuentra fuera de servicio por pausa/remodelación (${endMsg}). No se pueden realizar reservas de ningún tipo hasta que sea habilitado nuevamente.`,
        );
      }

      validReservations.push(data);
    }

    // Validación de Tiempo Pasado para reservas nuevas en lote (permitimos editar reservas existentes del mismo día)
    const now = new Date();
    const fiveMinutesBuffer = new Date(now.getTime() - 5 * 60 * 1000);
    for (const res of validReservations) {
      if (!res.id && new Date(res.start_time) < fiveMinutesBuffer) {
        throw new Error(
          `No es posible realizar reservas en fechas u horarios del pasado (detectado en fecha ${new Date(res.start_time).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}).`,
        );
      }
    }

    // 3. Global Conflict Check and RBAC
    let initialStatus = "APPROVED";
    let hasNeedsApproval = false;

    const batchActor = {
      role: publicUser.role,
      employment_type: publicUser.employment_type,
      job_category: publicUser.job_category,
      is_vip: publicUser.is_vip,
      perm_manage_assignments: publicUser.perm_manage_assignments,
    };
    const visibleSpacesBatch = getVisibleSpaceIdsForUser(batchActor);
    const batchCanNextVigencia = canAccessNextVigencia(batchActor);

    // Precargar asignaciones heredadas del rango del lote (1 consulta vs 2*N en el bucle)
    const legacyBoundsBySpaceDate = new Map<
      string,
      Array<{ bStart: number; bEnd: number }>
    >();
    if (!forceVipOverride && validReservations.length > 0) {
      try {
        const { data: areasData } = await supabase
          .from("areas")
          .select("id, name");

        const spaceIdByAreaId = new Map<number, string>();
        const targetSpacesInBatch = new Set(
          validReservations.map((r) => String(r.auditorium_id || "1")),
        );

        for (const area of areasData || []) {
          const mappedSpace = mapAreaNameToSpaceId(area.name);
          if (mappedSpace && targetSpacesInBatch.has(mappedSpace)) {
            spaceIdByAreaId.set(area.id, mappedSpace);
          }
        }

        const relevantAreaIds = Array.from(spaceIdByAreaId.keys());
        if (relevantAreaIds.length > 0) {
          const bogotaDates = validReservations
            .map((r) => getBogotaDateString(new Date(r.start_time)))
            .sort();
          const minBogotaDate = bogotaDates[0];
          const maxBogotaDate = bogotaDates[bogotaDates.length - 1];

          const { data: legacyRows } = await supabase
            .from("instructor_assignments")
            .select("id, area_id, assignment_date, time_block")
            .in("area_id", relevantAreaIds)
            .gte("assignment_date", minBogotaDate)
            .lte("assignment_date", maxBogotaDate);

          for (const row of legacyRows || []) {
            const spaceId = spaceIdByAreaId.get(row.area_id);
            if (!spaceId) continue;
            const bounds = getTimeBlockBounds(
              row.assignment_date,
              row.time_block,
            );
            const key = `${spaceId}|${row.assignment_date}`;
            const list = legacyBoundsBySpaceDate.get(key) || [];
            list.push({
              bStart: new Date(bounds.startIso).getTime(),
              bEnd: new Date(bounds.endIso).getTime(),
            });
            legacyBoundsBySpaceDate.set(key, list);
          }
        }
      } catch {
        // Mantener comportamiento no bloqueante si falla consulta auxiliar
      }
    }

    for (const res of validReservations) {
      const targetSpace = res.auditorium_id || "1";

      if (!visibleSpacesBatch.includes(String(targetSpace))) {
        throw new Error(
          "No tienes permisos para reservar el ambiente seleccionado.",
        );
      }

      if (
        !batchCanNextVigencia &&
        isDateBeyondCurrentVigencia(res.start_time)
      ) {
        throw new Error("Fecha no disponible para reserva en esta vigencia.");
      }

      // RBAC Check for Subdirección (ID 2)
      if (targetSpace === "2") {
        const employmentType = (publicUser.employment_type || "").toLowerCase();
        const isOfficial =
          employmentType.includes("planta") ||
          employmentType.includes("funcionario") ||
          employmentType.includes("oficial");

        if (!isOfficial && !isAdmin) {
          throw new Error(
            `No tienes permisos para reservar la Subdirección de Centro (detectado en fecha ${new Date(res.start_time).toLocaleDateString()}).`,
          );
        }
      } else if (targetSpace === "3") {
        const userEmail = (publicUser.email || "").toLowerCase();
        const isInstructor =
          publicUser.job_category?.toLowerCase() === "instructor";
        const isPlanta = publicUser.employment_type
          ?.toLowerCase()
          .includes("planta");

        const isStaff = isLibraryStaffEmail(userEmail);

        if (!isStaff && !isAdmin && !isVip && !isInstructor && !isPlanta) {
          throw new Error(
            `No tienes permisos para reservar la Biblioteca (detectado en fecha ${new Date(res.start_time).toLocaleDateString()}).`,
          );
        }

        // Business Rule: Instructors and Planta need approval, VIPs/Admins/Staff are approved immediately
        if ((isInstructor || isPlanta) && !isVip && !isAdmin && !isStaff) {
          initialStatus = "PENDING";
          hasNeedsApproval = true;
        }
      } else if (targetSpace === "4" || targetSpace === "5") {
        const spaceLabel =
          targetSpace === "5" ? "Ambiente de Cocina" : "Ambiente 107";
        const userEmail = (publicUser.email || "").toLowerCase();
        const isInstructor =
          (publicUser.job_category || "")
            .toLowerCase()
            .includes("instructor") ||
          (publicUser.role || "").toLowerCase().includes("instructor") ||
          (publicUser.area || "").toLowerCase().includes("instructor") ||
          (publicUser.employment_type || "")
            .toLowerCase()
            .includes("instructor");
        const isPlanta = publicUser.employment_type
          ?.toLowerCase()
          .includes("planta");

        const isStaff107 =
          isAmbiente107ApproverIdentity(cleanUsername, userEmail) ||
          isCoordinator;

        if (!isStaff107 && !isAdmin && !isVip && !isInstructor && !isPlanta) {
          throw new Error(
            `No tienes permisos para reservar el ${spaceLabel} (detectado en fecha ${new Date(res.start_time).toLocaleDateString()}).`,
          );
        }

        // Regla de Negocio: Ambiente 107 y Cocina requieren autorización expresa de Nury Mildret Barrera (nbarrerac@sena.edu.co)
        if ((isInstructor || isPlanta) && !isVip && !isAdmin && !isStaff107) {
          initialStatus = "PENDING";
          hasNeedsApproval = true;
        } else {
          initialStatus = "APPROVED";
          hasNeedsApproval = false;
        }
      }

      // Conflict Check (Scoped to space)
      let query = supabase
        .from("reservations")
        .select(
          "id, auditorium_id, start_time, end_time, status, user_id, title, users(id, full_name, is_vip, role)",
        )
        .in("status", ["APPROVED", "PENDING"])
        .eq("auditorium_id", targetSpace)
        .lt("start_time", res.end_time)
        .gt("end_time", res.start_time);

      // If we are updating (id exists), exclude current reservation from conflict check
      if (res.id) {
        query = query.neq("id", res.id);
      }

      const { data: conflicts, error: conflictError } = await query;

      if (conflictError) {
        console.error("Error checking conflicts:", conflictError);
        throw new Error("Error verificando disponibilidad de horario");
      }

      if (conflicts && conflicts.length > 0) {
        // Conflict Detected
        if (forceVipOverride && (isVip || isAdmin)) {
          // Validate that NONE of the conflicts are from another VIP (unless Admin)
          const hasVipConflict = conflicts.some((c) => {
            const conflictUser = (c as unknown as { users: PublicUser }).users;
            return (
              !!conflictUser?.is_vip ||
              conflictUser?.role?.toLowerCase() === "vip"
            );
          });

          if (hasVipConflict && !isAdmin) {
            throw new Error(
              "No puedes sobrescribir una reserva de otro usuario VIP.",
            );
          }

          // Intelligent Trimming / Rescheduling or Atomic Cancellation of Conflicts
          const adminConflictSupabase = getSupabaseAdmin();
          for (const conflict of conflicts) {
            const vipStart = new Date(res.start_time).getTime();
            const vipEnd = new Date(res.end_time).getTime();
            const confStart = new Date(conflict.start_time).getTime();
            const confEnd = new Date(conflict.end_time).getTime();

            if (vipStart <= confStart && vipEnd >= confEnd) {
              // VIP covers full duration -> Cancel entirely
              await cancelReservationAction(conflict.id, { silent: true });
            } else if (vipStart <= confStart && vipEnd < confEnd) {
              // VIP overlaps start of existing -> Trim existing start to vipEnd
              await adminConflictSupabase
                .from("reservations")
                .update({ start_time: new Date(vipEnd).toISOString() })
                .eq("id", conflict.id);
            } else if (vipStart > confStart && vipEnd >= confEnd) {
              // VIP overlaps end of existing -> Trim existing end to vipStart
              await adminConflictSupabase
                .from("reservations")
                .update({ end_time: new Date(vipStart).toISOString() })
                .eq("id", conflict.id);
            } else if (vipStart > confStart && vipEnd < confEnd) {
              // VIP in middle -> Adjust existing end to vipStart
              await adminConflictSupabase
                .from("reservations")
                .update({ end_time: new Date(vipStart).toISOString() })
                .eq("id", conflict.id);
            }
          }
        } else {
          throw new Error(
            `Conflicto detectado para el ${new Date(res.start_time).toLocaleDateString()} (se solapa con otra reserva en el mismo espacio)`,
          );
        }
      }

      if (!forceVipOverride) {
        const resDate = getBogotaDateString(new Date(res.start_time));
        const resStartMs = new Date(res.start_time).getTime();
        const resEndMs = new Date(res.end_time).getTime();
        const dayBounds =
          legacyBoundsBySpaceDate.get(`${String(targetSpace)}|${resDate}`) ||
          [];
        const hasLegacyOverlap = dayBounds.some(
          ({ bStart, bEnd }) => resStartMs < bEnd && resEndMs > bStart,
        );
        if (hasLegacyOverlap) {
          throw new Error(
            `Horario no disponible (existe una asignación de formación registrada en este ambiente el ${new Date(res.start_time).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })})`,
          );
        }
      }

      // Evitar multi-reservas simultáneas del mismo usuario en otros ambientes
      const { data: userConcurrentBatchRows } = await supabase
        .from("reservations")
        .select("id, auditorium_id, start_time, end_time, status, user_id")
        .in("status", ["APPROVED", "PENDING"])
        .eq("user_id", res.user_id)
        .lt("start_time", res.end_time)
        .gt("end_time", res.start_time);

      if (
        userConcurrentBatchRows &&
        hasCrossSpaceOverlap(
          userConcurrentBatchRows,
          String(targetSpace),
          res.start_time,
          res.end_time,
          res.id,
        )
      ) {
        throw new Error(
          "No puedes tener reservas simultáneas en diferentes ambientes en el mismo horario.",
        );
      }
    }

    // 4. Batch Upsert (Insert or Update) via adminSupabase so Coordinators/VIPs can edit/reassign any instructor's reservation
    const adminSupabase = getSupabaseAdmin();
    const isEditingExisting = validReservations.some((r) => !!r.id);

    // Normalizar siempre el user_id al ID público en la tabla users del funcionario/instructor que queda con la reserva
    const firstTargetUserId = validReservations[0]?.user_id;
    let resolvedBatchUserId = firstTargetUserId;
    if (firstTargetUserId && isValidUuid(firstTargetUserId)) {
      const { data: resolvedOwner } = await adminSupabase
        .from("users")
        .select("id")
        .or(buildUserIdOrFilter(firstTargetUserId))
        .maybeSingle();
      if (resolvedOwner?.id) {
        resolvedBatchUserId = resolvedOwner.id;
      }
    }

    const toInsert = validReservations.map((r) => ({
      ...(r.id ? { id: r.id } : {}), // Only include ID if it exists
      title: r.title,
      start_time: r.start_time,
      end_time: r.end_time,
      user_id: resolvedBatchUserId || r.user_id,
      auditorium_id: r.auditorium_id || "1",
      resources: r.resources || [], // Ensure array
      description: r.description || null,
      status: initialStatus,
    }));

    const { data: result, error } = await adminSupabase
      .from("reservations")
      .upsert(toInsert, { onConflict: "id" })
      .select();

    if (error) {
      console.error("Error inserting reservations:", error);
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "Uno de los horarios seleccionados acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw new Error(error.message || "Error al insertar reservas");
    }

    // --- NOTIFICATION LOGIC (BATCH SUMMARY) ---
    try {
      if (result && result.length > 0) {
        const targetOwnerId =
          resolvedBatchUserId || validReservations[0].user_id;
        const { data: userRaw } = isValidUuid(targetOwnerId)
          ? await adminSupabase
              .from("users")
              .select(
                "full_name, email, employment_type, job_category, username, id",
              )
              .or(buildUserIdOrFilter(targetOwnerId))
              .maybeSingle()
          : { data: null };

        if (!userRaw)
          throw new Error("Usuario no encontrado para notificación");
        const user = userRaw;

        const isLibrary = validReservations.some(
          (r) => String(r.auditorium_id) === "3",
        );
        const isMultiDay = validReservations.length > 1;

        // Resolver correo real de la persona o funcionario que queda con la reserva
        const recipientEmail = resolveReservationUserEmail(user);

        const titles = [...new Set(validReservations.map((r) => r.title))];
        const sortedRes = [...validReservations].sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        );

        const datesList = sortedRes
          .map((r) => {
            const d = new Date(r.start_time);
            return d.toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
              timeZone: "America/Bogota",
            });
          })
          .join(", ");

        const first = sortedRes[0];
        const timeStr = `${new Date(first.start_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })} - ${new Date(first.end_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}`;

        const isAmbiente107 = validReservations.some(
          (r) => String(r.auditorium_id) === "4",
        );
        const isCocina = validReservations.some(
          (r) => String(r.auditorium_id) === "5",
        );

        // A1. Ambiente 107 & Cocina Batch Notification (Coordinador Activo + Funcionario/Instructor titular)
        if (isAmbiente107 || isCocina) {
          const spaceLabel = isCocina ? "Ambiente de Cocina" : "Ambiente 107";
          const coordinator = await getSpaceCoordinator(isCocina ? "5" : "4");
          const coordinatorSubject =
            initialStatus === "PENDING"
              ? `Solicitud de Prereserva ${spaceLabel}: ${titles[0]}`
              : isEditingExisting
                ? `Reserva Actualizada (${spaceLabel}): ${titles[0]}`
                : `Reserva VIP Aprobada (${spaceLabel}): ${titles[0]}`;

          if (
            initialStatus === "PENDING" ||
            recipientEmail.toLowerCase() !== coordinator.email.toLowerCase()
          ) {
            await EmailService.send({
              to: coordinator.email,
              subject: coordinatorSubject,
              react: SpaceReservationEmail({
                spaceName: spaceLabel,
                requesterName: user.full_name,
                eventTitle: isMultiDay
                  ? `${titles[0]} (Lote de ${validReservations.length} días)`
                  : titles[0],
                date: datesList,
                timeRange: timeStr,
                specialRequirements:
                  validReservations[0].description || "Ninguno",
                coordinatorName: coordinator.full_name,
                type:
                  initialStatus === "PENDING" ? "NEW_REQUEST" : "VIP_AUTOMATIC",
              }),
            });
          }

          if (initialStatus === "PENDING") {
            // Enviar notificación de prerreserva al correo del funcionario/instructor que queda con la reserva
            if (recipientEmail && recipientEmail.includes("@")) {
              await EmailService.send({
                to: recipientEmail,
                subject: `Solicitud de Prereserva Recibida (${spaceLabel}): ${titles[0]}`,
                react: SpaceReservationEmail({
                  spaceName: spaceLabel,
                  requesterName: user.full_name,
                  eventTitle: isMultiDay
                    ? `${titles[0]} (Lote de ${validReservations.length} días)`
                    : titles[0],
                  date: datesList,
                  timeRange: timeStr,
                  specialRequirements:
                    validReservations[0].description || "Ninguno",
                  coordinatorName: coordinator.full_name,
                  type: "NEW_REQUEST",
                }),
              });
            }

            await adminSupabase.from("user_notifications").insert([
              {
                user_id: user.id,
                title: `Prereserva en revisión (${spaceLabel}) ⏳`,
                message: `Tu solicitud "${titles[0]}" (${datesList}) fue enviada a coordinación para autorización.`,
              },
            ]);

            revalidatePath("/dashboard");
            return { success: true, data: result, pendingApproval: true };
          }
        }

        // A2. Library Batch Notification (Coordinación Biblioteca Activa + Funcionario/Instructor titular)
        if (isLibrary) {
          const libraryCoord = await getSpaceCoordinator("3");
          const coordinatorSubject =
            initialStatus === "PENDING"
              ? `Solicitud de Reserva Biblioteca: ${titles[0]}`
              : isEditingExisting
                ? `Reserva Actualizada (Biblioteca): ${titles[0]}`
                : `Reserva Grupal VIP Aprobada (Cuentadante): ${titles[0]}`;

          if (
            initialStatus === "PENDING" ||
            recipientEmail.toLowerCase() !== libraryCoord.email.toLowerCase()
          ) {
            await EmailService.send({
              to: libraryCoord.email,
              subject: coordinatorSubject,
              react: SupportNotification({
                requesterName: user.full_name,
                requesterEmail: recipientEmail || user.email || undefined,
                eventTitle: isMultiDay
                  ? `${titles[0]} (Lote de ${validReservations.length} días)`
                  : titles[0],
                date: datesList,
                timeRange: timeStr,
                specialRequirements:
                  validReservations[0].description || "Ninguno",
                type:
                  initialStatus === "PENDING"
                    ? "NEW_REQUIREMENT"
                    : "VIP_OVERRIDE",
              }),
            });
          }

          if (initialStatus === "PENDING") {
            if (recipientEmail && recipientEmail.includes("@")) {
              await EmailService.send({
                to: recipientEmail,
                subject: `Solicitud de Prereserva Recibida (Biblioteca): ${titles[0]}`,
                react: SpaceReservationEmail({
                  spaceName: "Biblioteca",
                  requesterName: user.full_name,
                  eventTitle: isMultiDay
                    ? `${titles[0]} (Lote de ${validReservations.length} días)`
                    : titles[0],
                  date: datesList,
                  timeRange: timeStr,
                  specialRequirements:
                    validReservations[0].description || "Ninguno",
                  coordinatorName: "Coordinación de Biblioteca",
                  type: "NEW_REQUEST",
                }),
              });
            }

            await adminSupabase.from("user_notifications").insert([
              {
                user_id: user.id,
                title: "Prereserva en revisión (Biblioteca) ⏳",
                message: `Tu solicitud "${titles[0]}" (${datesList}) fue enviada a Biblioteca para autorización.`,
              },
            ]);

            revalidatePath("/dashboard");
            return { success: true, data: result, pendingApproval: true };
          }
        }

        // B. Notificación de Confirmación o Actualización al correo de la persona/funcionario que queda con la reserva
        if (recipientEmail && recipientEmail.includes("@")) {
          const spaceLabel = getSpaceDisplayName(first.auditorium_id);
          const emailSubject = isEditingExisting
            ? `Actualización de Reserva (${spaceLabel}): ${titles[0]}`
            : isMultiDay
              ? `Reserva Grupal Confirmada (${spaceLabel}): ${titles[0]}`
              : `Reserva Confirmada (${spaceLabel}): ${titles[0]}`;

          const eventTitleDisplay = isEditingExisting
            ? `${titles[0]} (Actualizada)`
            : isMultiDay
              ? `${titles[0]} (Lote de ${validReservations.length} días)`
              : titles[0];

          await EmailService.send({
            to: recipientEmail,
            subject: emailSubject,
            react: ReservationConfirmation({
              userName: user.full_name,
              eventTitle: eventTitleDisplay,
              date: datesList,
              timeRange: timeStr,
              location: spaceLabel,
              resources: first.resources || [],
              specialRequirements: first.description,
            }),
          });

          if (isEditingExisting) {
            await adminSupabase.from("user_notifications").insert([
              {
                user_id: user.id,
                title: "Reserva Actualizada / Asignada 📅",
                message: `La reserva "${titles[0]}" en ${spaceLabel} para el ${datesList} (${timeStr}) se encuentra registrada a tu nombre.`,
              },
            ]);
          }

          // Coordinator summary - ONLY IF description has valid special requirements
          const allDescriptions = validReservations
            .map((r) => r.description)
            .filter((d) => hasValidDescription(d));

          if (allDescriptions.length > 0 && !isLibrary) {
            const targetCoord = await getSpaceCoordinator(
              first.auditorium_id || "1",
            );
            await EmailService.send({
              to: targetCoord.email || "jeavendano@sena.edu.co",
              subject: isEditingExisting
                ? `🔄 Requerimiento Actualizado (${spaceLabel}): ${titles[0]}`
                : `⚠️ Múltiples Requerimientos (${spaceLabel}): ${titles[0]}`,
              react: SupportNotification({
                requesterName: user.full_name,
                requesterEmail: recipientEmail,
                eventTitle: titles[0],
                date: datesList,
                timeRange: timeStr,
                specialRequirements: [...new Set(allDescriptions)].join(" | "),
                type: "NEW_REQUIREMENT",
              }),
            });
          }
        }
      }
    } catch (err) {
      console.error("Batch Email Error:", err);
    }

    revalidatePath("/dashboard");
    return { success: true, data: result, pendingApproval: hasNeedsApproval };
  } catch (error: unknown) {
    const errorMsg =
      (error as Record<string, unknown>)?.message ||
      (typeof error === "object"
        ? JSON.stringify(error)
        : String(error || "Error en creación masiva"));
    await Logger.error("Batch Reservation Creation Failed", { error });
    return { error: String(errorMsg) };
  }
}
