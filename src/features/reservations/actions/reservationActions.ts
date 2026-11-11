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
import {
  MaintenanceCancellationNotification,
  ReservationItem,
} from "@/lib/email/templates/MaintenanceCancellationNotification";
import { ReservationSchema } from "../schemas";
import Logger from "@/lib/logger";

function hasValidDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  const trimmed = desc.trim();
  if (trimmed.length === 0) return false;
  // Normalize by removing common punctuation and extra spaces, then lowercase
  const normalized = trimmed
    .toLowerCase()
    .replace(/[.,\-_/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const blacklist = [
    "ninguno",
    "ninguna",
    "no",
    "na",
    "no aplica",
    "sin requerimientos",
    "ningun",
    "0",
    "ningunos",
    "ningunas",
    "nada",
    "sin novedad",
  ];
  return !blacklist.includes(normalized) && normalized.length > 0;
}

/**
 * Resuelve el correo electrónico real del titular/responsable de la reserva:
 * - Funcionarios de planta / oficiales / coordinadores -> {username}@sena.edu.co
 * - Contratistas / externos -> correo registrado (si no es @sistema.local), o fallback a {username}@sena.edu.co
 */
function resolveReservationUserEmail(
  user:
    | {
        email?: string | null;
        username?: string | null;
        employment_type?: string | null;
        job_category?: string | null;
      }
    | null
    | undefined,
): string {
  if (!user) return "";
  const empType = (user.employment_type || "").toLowerCase();
  const jobCat = (user.job_category || "").toLowerCase();
  const isOfficial =
    empType.includes("planta") ||
    empType.includes("funcionario") ||
    empType.includes("oficial") ||
    jobCat.includes("coordinador");

  const rawEmail = (user.email || "").trim().toLowerCase();
  const cleanUser = (user.username || "").trim().toLowerCase();

  if (isOfficial && cleanUser) {
    return `${cleanUser}@sena.edu.co`;
  }
  if (
    rawEmail &&
    rawEmail.includes("@") &&
    !rawEmail.endsWith("@sistema.local")
  ) {
    return rawEmail;
  }
  if (cleanUser) {
    return `${cleanUser}@sena.edu.co`;
  }
  return "";
}

function getSpaceDisplayName(auditoriumId?: string | number | null): string {
  const id = String(auditoriumId || "1");
  if (id === "2") return "Subdirección";
  if (id === "3") return "Biblioteca";
  if (id === "4") return "Ambiente 107";
  if (id === "5") return "Ambiente de Cocina";
  return "Auditorio Principal";
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
        .select("description, users(full_name)")
        .eq("id", reservationId)
        .single();

      if (hasValidDescription(resDetails?.description) && !silent) {
        const userDetails = resDetails?.users as unknown as {
          full_name: string;
        } | null;
        await EmailService.send({
          to: "jeavendano@sena.edu.co",
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

export interface AssignableUser {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: string | null;
  job_category: string | null;
  employment_type: string | null;
  area: string | null;
}

/**
 * Retorna la lista de instructores y funcionarios activos para que un coordinador o administrador
 * pueda asignar una reserva a su nombre.
 */
export async function getAssignableUsersAction(): Promise<{
  success: boolean;
  users: AssignableUser[];
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return { success: false, users: [] };

    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
      .from("users")
      .select(
        "id, full_name, username, email, role, job_category, employment_type, area",
      )
      .or("is_active.eq.true,is_active.is.null")
      .is("deleted_at", null)
      .order("full_name", { ascending: true });

    if (error || !data) return { success: false, users: [] };
    return { success: true, users: data as AssignableUser[] };
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return { success: false, users: [] };
  }
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
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
        cleanUsername,
      );

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

    // Validación de Remodelación / Mantenimiento
    if ((auditorium_id || "1") === "1" && !isAdmin) {
      const { data: mSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "auditorium_maintenance")
        .maybeSingle();

      if (mSetting?.value) {
        const mConfig = mSetting.value as unknown as {
          is_active: boolean;
          start_date: string;
          end_date?: string | null;
        };

        if (mConfig.is_active && mConfig.start_date) {
          const resDate = new Date(start_time).toLocaleDateString("en-CA", {
            timeZone: "America/Bogota",
          });
          const mStart = mConfig.start_date;
          const mEnd = mConfig.end_date || "2026-12-31";

          if (resDate >= mStart && resDate <= mEnd) {
            const endMsg = mConfig.end_date
              ? `hasta el ${mConfig.end_date}`
              : "por el resto de la vigencia 2026";
            throw new Error(
              `El Auditorio se encuentra fuera de servicio por remodelación a partir del ${mStart} (${endMsg}). Para más información, diríjase a la Coordinación Académica o de Formación.`,
            );
          }
        }
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

    // 4. RBAC Check for Subdirección (ID 2) and Biblioteca (ID 3)
    const currentSpace = auditorium_id || "1";
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

      const isStaff = [
        "egutierrezn@sistema.local",
        "rbiblioteca@sistema.local",
      ].includes(userEmail);

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
        ["nbarrerac@sena.edu.co", "dasanchezh@sena.edu.co"].some((mail) =>
          userEmail.includes(mail.toLowerCase()),
        ) ||
        ["nbarrerac", "dasanchezh"].includes(cleanUsername) ||
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
    const { data: targetOwner } = await adminSupabase
      .from("users")
      .select("id")
      .or(`id.eq.${user_id},auth_id.eq.${user_id}`)
      .maybeSingle();
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

    if (error) throw error;

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

      // Business Rule: Notifications for Ambiente 107 & Cocina go to Nury Mildret Barrera (nbarrerac@sena.edu.co) AND to the reservation owner
      if (isAmbiente107 || isCocina) {
        const spaceLabel = isCocina ? "Ambiente de Cocina" : "Ambiente 107";

        const coordinatorSubject =
          reservation.status === "PENDING"
            ? `Solicitud de Prereserva ${spaceLabel}: ${reservation.title}`
            : `Reserva VIP Aprobada (${spaceLabel}): ${reservation.title}`;

        if (
          reservation.status === "PENDING" ||
          recipientEmail.toLowerCase() !== "nbarrerac@sena.edu.co"
        ) {
          await EmailService.send({
            to: "nbarrerac@sena.edu.co",
            subject: coordinatorSubject,
            react: SpaceReservationEmail({
              spaceName: spaceLabel,
              requesterName: user.full_name,
              eventTitle: reservation.title,
              date: dateStr,
              timeRange: `${timeStr} (${durationHours.toFixed(1)} horas)`,
              specialRequirements: reservation.description || "Ninguno",
              coordinatorName: "Nury Mildret Barrera",
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
                coordinatorName: "Nury Mildret Barrera",
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

      // Business Rule: Notifications for Library go to coordinator (egutierrezn@sena.edu.co) AND to the reservation owner
      if (isLibrary) {
        const coordinatorSubject =
          reservation.status === "PENDING"
            ? `Solicitud de Reserva Biblioteca: ${reservation.title}`
            : `Reserva VIP Aprobada (Cuentadante): ${reservation.title}`;

        if (
          reservation.status === "PENDING" ||
          recipientEmail.toLowerCase() !== "egutierrezn@sena.edu.co"
        ) {
          await EmailService.send({
            to: "egutierrezn@sena.edu.co",
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
                coordinatorName: "Coordinación de Biblioteca",
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
          await EmailService.send({
            to: "jeavendano@sena.edu.co",
            subject: `⚠️ Nuevo Requerimiento Especial: ${reservation.title}`,
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
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
        cleanUsername,
      );

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
      const isAllowed = [
        "egutierrezn@sistema.local",
        "rbiblioteca@sistema.local",
      ].includes(userEmail);

      if (!isAllowed && !isAdmin && !isVip) {
        throw new Error(
          "Solo los encargados de Biblioteca, coordinadores o administradores pueden realizar esta reserva.",
        );
      }
    }

    // 5. Update (use adminSupabase so Coordinators/VIPs can edit & reassign any instructor's reservation without RLS blocking)
    const adminSupabase = getSupabaseAdmin();
    const { data: targetOwner } = await adminSupabase
      .from("users")
      .select("id, full_name, email, employment_type, job_category, username")
      .or(`id.eq.${user_id},auth_id.eq.${user_id}`)
      .maybeSingle();

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

    if (error) throw error;

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
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
        cleanUsername,
      );

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

      // Validación de Remodelación / Mantenimiento
      if ((data.auditorium_id || "1") === "1" && !isAdmin) {
        const { data: mSetting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "auditorium_maintenance")
          .maybeSingle();

        if (mSetting?.value) {
          const mConfig = mSetting.value as unknown as {
            is_active: boolean;
            start_date: string;
            end_date?: string | null;
          };

          if (mConfig.is_active && mConfig.start_date) {
            const resDate = new Date(data.start_time).toLocaleDateString(
              "en-CA",
              {
                timeZone: "America/Bogota",
              },
            );
            const mStart = mConfig.start_date;
            const mEnd = mConfig.end_date || "2026-12-31";

            if (resDate >= mStart && resDate <= mEnd) {
              const endMsg = mConfig.end_date
                ? `hasta el ${mConfig.end_date}`
                : "por el resto de la vigencia 2026";
              throw new Error(
                `El Auditorio se encuentra fuera de servicio por remodelación a partir del ${mStart} (${endMsg}). Para más información, diríjase a la Coordinación Académica o de Formación.`,
              );
            }
          }
        }
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

    for (const res of validReservations) {
      const targetSpace = res.auditorium_id || "1";

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

        const isStaff = [
          "egutierrezn@sistema.local",
          "rbiblioteca@sistema.local",
        ].includes(userEmail);

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
          ["nbarrerac@sena.edu.co", "dasanchezh@sena.edu.co"].some((mail) =>
            userEmail.includes(mail.toLowerCase()),
          ) ||
          ["nbarrerac", "dasanchezh"].includes(cleanUsername) ||
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
        .select("*, users(id, full_name, is_vip, role)") // Select user details to check their status
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
    }

    // 4. Batch Upsert (Insert or Update) via adminSupabase so Coordinators/VIPs can edit/reassign any instructor's reservation
    const adminSupabase = getSupabaseAdmin();
    const isEditingExisting = validReservations.some((r) => !!r.id);

    // Normalizar siempre el user_id al ID público en la tabla users del funcionario/instructor que queda con la reserva
    const firstTargetUserId = validReservations[0]?.user_id;
    let resolvedBatchUserId = firstTargetUserId;
    if (firstTargetUserId) {
      const { data: resolvedOwner } = await adminSupabase
        .from("users")
        .select("id")
        .or(`id.eq.${firstTargetUserId},auth_id.eq.${firstTargetUserId}`)
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
      throw new Error(error.message || "Error al insertar reservas");
    }

    // --- NOTIFICATION LOGIC (BATCH SUMMARY) ---
    try {
      if (result && result.length > 0) {
        const targetOwnerId =
          resolvedBatchUserId || validReservations[0].user_id;
        const { data: userRaw } = await adminSupabase
          .from("users")
          .select(
            "full_name, email, employment_type, job_category, username, id",
          )
          .or(`id.eq.${targetOwnerId},auth_id.eq.${targetOwnerId}`)
          .maybeSingle();

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

        // A1. Ambiente 107 & Cocina Batch Notification (Nury Mildret Barrera + Funcionario/Instructor titular)
        if (isAmbiente107 || isCocina) {
          const spaceLabel = isCocina ? "Ambiente de Cocina" : "Ambiente 107";
          const coordinatorSubject =
            initialStatus === "PENDING"
              ? `Solicitud de Prereserva ${spaceLabel}: ${titles[0]}`
              : isEditingExisting
                ? `Reserva Actualizada (${spaceLabel}): ${titles[0]}`
                : `Reserva VIP Aprobada (${spaceLabel}): ${titles[0]}`;

          if (
            initialStatus === "PENDING" ||
            recipientEmail.toLowerCase() !== "nbarrerac@sena.edu.co"
          ) {
            await EmailService.send({
              to: "nbarrerac@sena.edu.co",
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
                coordinatorName: "Nury Mildret Barrera",
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
                  coordinatorName: "Nury Mildret Barrera",
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

        // A2. Library Batch Notification (Coordinación Biblioteca + Funcionario/Instructor titular)
        if (isLibrary) {
          const coordinatorSubject =
            initialStatus === "PENDING"
              ? `Solicitud de Reserva Biblioteca: ${titles[0]}`
              : isEditingExisting
                ? `Reserva Actualizada (Biblioteca): ${titles[0]}`
                : `Reserva Grupal VIP Aprobada (Cuentadante): ${titles[0]}`;

          if (
            initialStatus === "PENDING" ||
            recipientEmail.toLowerCase() !== "egutierrezn@sena.edu.co"
          ) {
            await EmailService.send({
              to: "egutierrezn@sena.edu.co",
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
            await EmailService.send({
              to: "jeavendano@sena.edu.co",
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

export async function getAuditoriumMaintenanceAction() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "auditorium_maintenance")
      .maybeSingle();

    if (data && data.value) {
      return { success: true, config: data.value };
    }
    return {
      success: true,
      config: {
        is_active: false,
        space_id: "1",
        start_date: "2026-09-01",
        end_date: null,
        custom_title: "Auditorio en Remodelación",
        custom_message: "",
      },
    };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al consultar configuración de remodelación",
    };
  }
}

export async function saveAuditoriumMaintenanceAction(config: {
  is_active: boolean;
  space_id: string;
  start_date: string;
  end_date?: string | null;
  custom_title?: string;
  custom_message?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .single();

    const isAdmin = ["admin", "superadmin"].includes(
      publicUser?.role?.toLowerCase() || "",
    );
    if (!isAdmin) {
      throw new Error(
        "Solo administradores pueden configurar el estado de remodelación/mantenimiento.",
      );
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase.from("system_settings").upsert(
      {
        key: "auditorium_maintenance",
        value: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) throw error;

    let cancelledCount = 0;
    let usersNotified = 0;

    // --- BARRIDO DE RESERVAS Y CANCELACIÓN CONSOLIDADA POR USUARIO ---
    if (config.is_active && config.start_date) {
      const spaceTarget = config.space_id || "1";
      const startDateTime = `${config.start_date}T00:00:00-05:00`;
      const endDateTime = config.end_date
        ? `${config.end_date}T23:59:59-05:00`
        : "2026-12-31T23:59:59-05:00";

      // 1. Buscar todas las reservas activas en el auditorio dentro de la ventana de suspensión
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

        // 2. Cancelar todas las reservas afectadas en la base de datos
        await adminSupabase
          .from("reservations")
          .update({ status: "CANCELLED" })
          .in("id", resIds);

        // 2.1 Cancelar automáticamente los tickets de soporte asociados en la bandeja de los técnicos
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
                  comment:
                    "CANCELACIÓN AUTOMÁTICA: Reserva cancelada por obras de remodelación en Auditorio.",
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

        // 3. Agrupar las reservas afectadas por usuario
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

        // 4. Formatear fechas para el correo
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

        const humanStart = formatHumanDate(config.start_date);
        const humanEnd = config.end_date
          ? formatHumanDate(config.end_date)
          : null;

        // 5. Enviar exactamente UN correo consolidado por usuario
        for (const group of userGroupsMap.values()) {
          try {
            // Notificación interna en la BD
            await adminSupabase.from("user_notifications").insert([
              {
                user_id: group.userId,
                title: "Reserva(s) Cancelada(s) por Remodelación",
                message: `Tus ${group.reservations.length} reserva(s) del Auditorio a partir del ${humanStart} han sido canceladas debido a obras de remodelación física.`,
              },
            ]);

            // Envío de correo electrónico consolidado
            await EmailService.send({
              to: group.email,
              subject:
                "⚠️ Aviso Importante: Cancelación de Reservas por Remodelación de Auditorio",
              react: MaintenanceCancellationNotification({
                userName: group.userName,
                startDate: humanStart,
                endDate: humanEnd,
                reservations: group.reservations,
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
          `Barrido de remodelación: ${cancelledCount} reservas canceladas y ${usersNotified} usuarios notificados por correo consolidado.`,
        );
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return {
      success: true,
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

export async function updateInstructorAssignmentAction(params: {
  id: number;
  instructor_id: string;
  assignment_date: string;
  time_block: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select(
        "id, role, job_category, username, is_vip, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const cleanUsername = (publicUser?.username || "").toLowerCase().trim();
    const canManage =
      ["admin", "superadmin", "coordinator", "vip"].includes(
        (publicUser?.role || "").toLowerCase(),
      ) ||
      (publicUser?.job_category || "").toLowerCase() === "coordinador" ||
      !!publicUser?.perm_manage_assignments ||
      !!publicUser?.is_vip ||
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
        cleanUsername,
      );

    if (!canManage) {
      throw new Error(
        "No tienes permisos para editar o reasignar asignaciones",
      );
    }

    const adminSupabase = getSupabaseAdmin();

    // Check existing assignment to get area_id
    const { data: currentAssign, error: fetchErr } = await adminSupabase
      .from("instructor_assignments")
      .select("area_id")
      .eq("id", params.id)
      .single();

    if (fetchErr || !currentAssign) {
      throw new Error("Asignación no encontrada");
    }

    // Check conflicts in same area, date, and block (excluding current id)
    const { data: conflict } = await adminSupabase
      .from("instructor_assignments")
      .select("id")
      .eq("area_id", currentAssign.area_id)
      .eq("assignment_date", params.assignment_date)
      .eq("time_block", params.time_block)
      .neq("id", params.id)
      .maybeSingle();

    if (conflict) {
      throw new Error(
        "Ya existe otra asignación en este mismo ambiente, fecha y bloque horario.",
      );
    }

    const { error: updateErr } = await adminSupabase
      .from("instructor_assignments")
      .update({
        instructor_id: params.instructor_id,
        assignment_date: params.assignment_date,
        time_block: params.time_block,
      })
      .eq("id", params.id);

    if (updateErr) throw updateErr;

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al actualizar la asignación",
    };
  }
}

export async function deleteInstructorAssignmentAction(assignmentId: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select(
        "id, role, job_category, username, is_vip, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const cleanUsername = (publicUser?.username || "").toLowerCase().trim();
    const canManage =
      ["admin", "superadmin", "coordinator", "vip"].includes(
        (publicUser?.role || "").toLowerCase(),
      ) ||
      (publicUser?.job_category || "").toLowerCase() === "coordinador" ||
      !!publicUser?.perm_manage_assignments ||
      !!publicUser?.is_vip ||
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
        cleanUsername,
      );

    if (!canManage) {
      throw new Error("No tienes permisos para eliminar asignaciones");
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
      .from("instructor_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) throw error;

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error ? err.message : "Error al eliminar la asignación",
    };
  }
}

export async function syncReservationTicketAction(params: {
  oldTitle: string;
  previousUserId?: string;
  newUserId: string;
  fullNewDescription: string;
  isoStart: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return { success: false };

    const adminSupabase = getSupabaseAdmin();
    const oldDescSubstring = `: ${params.oldTitle}`;

    let query = adminSupabase
      .from("tickets")
      .select("*")
      .eq("category", "Reserva Auditorio")
      .ilike("description", `%${oldDescSubstring}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (params.previousUserId) {
      query = query.eq("user_id", params.previousUserId);
    }

    const { data: tickets } = await query;
    if (!tickets || tickets.length === 0) {
      return { success: false };
    }

    const ticket = tickets[0];
    const now = new Date();
    const eventStart = new Date(params.isoStart);
    const hoursDiff = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    let newStatus = ticket.status;
    let slaStatus = ticket.sla_status;

    if (["PENDIENTE", "EN_ESPERA"].includes(ticket.status)) {
      if (hoursDiff > 24) {
        newStatus = "EN_ESPERA";
        slaStatus = "paused";
      } else {
        newStatus = "PENDIENTE";
        slaStatus = "running";
      }
    }

    await adminSupabase
      .from("tickets")
      .update({
        user_id: params.newUserId || ticket.user_id,
        description: params.fullNewDescription,
        event_date: params.isoStart,
        status: newStatus,
        sla_status: slaStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    return { success: true };
  } catch (err) {
    console.error("Error syncing reservation ticket:", err);
    return { success: false };
  }
}

export async function getEnvironmentsGlobalConfigAction() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    const val = (data?.value || {}) as {
      tab_order?: number[];
      disabled_area_ids?: number[];
      disabled_special_spaces?: string[];
      updated_at?: string;
      updated_by?: string;
    };

    return {
      success: true,
      config: {
        tab_order: Array.isArray(val.tab_order) ? val.tab_order : [],
        disabled_area_ids: Array.isArray(val.disabled_area_ids)
          ? val.disabled_area_ids
          : [],
        disabled_special_spaces: Array.isArray(val.disabled_special_spaces)
          ? val.disabled_special_spaces
          : [],
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
      },
    };
  }
}

export async function saveEnvironmentsTabOrderAction(tabOrder: number[]) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select(
        "id, full_name, role, job_category, username, is_vip, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const roleLower = (publicUser?.role || "").toLowerCase();
    const jobCatLower = (publicUser?.job_category || "").toLowerCase();
    const cleanUsername = (publicUser?.username || "").toLowerCase().trim();

    const isSuperAdmin = roleLower === "superadmin";
    const isCoordinator =
      jobCatLower === "coordinador" ||
      roleLower === "coordinator" ||
      !!publicUser?.perm_manage_assignments ||
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
        cleanUsername,
      );

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

    const currentVal = (existing?.value || {}) as {
      tab_order?: number[];
      disabled_area_ids?: number[];
      disabled_special_spaces?: string[];
    };

    const newConfig = {
      tab_order: tabOrder,
      disabled_area_ids: Array.isArray(currentVal.disabled_area_ids)
        ? currentVal.disabled_area_ids
        : [],
      disabled_special_spaces: Array.isArray(currentVal.disabled_special_spaces)
        ? currentVal.disabled_special_spaces
        : [],
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

    if (error) throw error;

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
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select("id, full_name, role, username")
      .eq("auth_id", authUser.id)
      .single();

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

    const currentVal = (existing?.value || {}) as {
      tab_order?: number[];
      disabled_area_ids?: number[];
      disabled_special_spaces?: string[];
    };

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

    const newConfig = {
      tab_order: Array.isArray(currentVal.tab_order)
        ? currentVal.tab_order
        : [],
      disabled_area_ids: disabledAreaIds,
      disabled_special_spaces: disabledSpecialSpaces,
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

    if (error) throw error;

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
