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
          .select("full_name, email, employment_type, username")
          .eq("id", reservation.user_id)
          .single();

        if (victim) {
          const victimEmail =
            victim.employment_type?.toLowerCase().includes("planta") ||
            victim.employment_type?.toLowerCase().includes("funcionario")
              ? `${victim.username.trim()}@sena.edu.co`.toLowerCase()
              : victim.email;

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
        "id, role, employment_type, email, username, job_category, is_vip",
      )
      .eq("auth_id", authUser.id)
      .single();

    const publicUser = publicUserRaw as unknown as PublicUser;

    if (publicUser?.id !== user_id) {
      const isAdmin = ["admin", "superadmin"].includes(
        publicUser?.role?.toLowerCase() || "",
      );
      if (!isAdmin)
        throw new Error(
          "No tienes permisos para crear reservas a nombre de otros",
        );
    }

    // Validación de Fines de Semana para Funcionarios Normales
    const isVip =
      !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";
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
    }

    // 5. Insert
    const { data: result, error } = await supabase
      .from("reservations")
      .insert([
        {
          title,
          start_time,
          end_time,
          user_id,
          auditorium_id: auditorium_id || "1",
          resources,
          description,
          status: initialStatus,
        },
      ])
      .select("*, users(full_name, email, employment_type, username)")
      .single();

    if (error) throw error;

    // --- NOTIFICATION LOGIC ---
    try {
      const reservation = result;
      const user = reservation.users;
      const isLibrary = String(reservation.auditorium_id) === "3";

      // Business Rule: Notifications for Library always go to the coordinator (temp: dasanchezh)
      if (isLibrary) {
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

        // Notify Coordinator (Temporary: dasanchezh@sena.edu.co)
        const coordinatorSubject =
          reservation.status === "PENDING"
            ? `Solicitud de Reserva Biblioteca: ${reservation.title}`
            : `Reserva VIP Aprobada (Cuentadante): ${reservation.title}`;

        // TODO(MERGE): Cambiar correo a egutierrezn@sena.edu.co (o emgutierrezn@sena.edu.co) para produccion.
        await EmailService.send({
          to: "dasanchezh@sena.edu.co",
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

        // Don't send "Confirmation" to user yet if it's PENDING
        if (reservation.status === "PENDING") {
          revalidatePath("/dashboard");
          return { success: true, data: result, pendingApproval: true };
        }
      }

      // Default confirmation for Auditorium / Subdireccion or Library (if already APPROVED)
      // Regla de Negocio:
      // - Funcionarios/Planta -> Siempre @sena.edu.co (basado en username)
      // - Contratistas -> Correo registrado (personal o corporativo)
      const employmentType = (user.employment_type || "").toLowerCase();
      const isOfficial =
        employmentType.includes("planta") ||
        employmentType.includes("funcionario") ||
        employmentType.includes("oficial");

      let recipientEmail = user.email;

      if (isOfficial) {
        recipientEmail = `${user.username.trim()}@sena.edu.co`.toLowerCase();
      }
      if (recipientEmail && recipientEmail.includes("@")) {
        const startDate = new Date(reservation.start_time);
        const endDate = new Date(reservation.end_time);
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

        await EmailService.send({
          to: recipientEmail,
          subject: `Reserva Confirmada: ${reservation.title}`,
          react: ReservationConfirmation({
            userName: user.full_name,
            eventTitle: reservation.title,
            date: dateStr,
            timeRange: timeStr,
            location: isLibrary
              ? "Biblioteca"
              : String(reservation.auditorium_id) === "2"
                ? "Subdirección"
                : "Auditorio Principal",
            resources: reservation.resources || [],
            specialRequirements: reservation.description,
          }),
        });
        if (
          reservation.description &&
          reservation.description.trim().length > 0 &&
          !isLibrary
        ) {
          await EmailService.send({
            to: "jeavendano@sena.edu.co",
            subject: `⚠️ Nuevo Requerimiento Especial: ${reservation.title}`,
            react: SupportNotification({
              requesterName: user.full_name,
              requesterEmail: recipientEmail,
              eventTitle: reservation.title,
              date: dateStr,
              timeRange: timeStr,
              specialRequirements: reservation.description,
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
      .select("id, is_vip, role, employment_type, email")
      .eq("auth_id", authUser.id)
      .single();

    const isOwner = publicUser?.id === existing.user_id;
    const isVip =
      !!publicUser?.is_vip || publicUser?.role?.toLowerCase() === "vip";
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
      const isVip = !!publicUser?.is_vip;

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

      if (!isAllowed && !isAdmin) {
        throw new Error(
          "Solo los encargados de Biblioteca o administradores pueden realizar esta reserva.",
        );
      }
    }

    // 5. Update
    const { data: result, error } = await supabase
      .from("reservations")
      .update({
        title,
        start_time,
        end_time,
        user_id,
        auditorium_id: auditorium_id || "1",
        resources,
        description,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

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
        "id, role, is_vip, full_name, employment_type, email, job_category, username",
      )
      .eq("auth_id", authUser.id)
      .single();

    if (userError || !publicUserRaw)
      throw new Error("Usuario no encontrado en base de datos");

    const publicUser = publicUserRaw as unknown as PublicUser;

    const isVip =
      !!publicUser.is_vip || publicUser.role?.toLowerCase() === "vip";
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

      // Identity check
      if (publicUser.id !== data.user_id) {
        if (!isAdmin)
          throw new Error(
            "No tienes permisos para crear reservas a nombre de otros",
          );
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
              await supabase
                .from("reservations")
                .update({ start_time: new Date(vipEnd).toISOString() })
                .eq("id", conflict.id);
            } else if (vipStart > confStart && vipEnd >= confEnd) {
              // VIP overlaps end of existing -> Trim existing end to vipStart
              await supabase
                .from("reservations")
                .update({ end_time: new Date(vipStart).toISOString() })
                .eq("id", conflict.id);
            } else if (vipStart > confStart && vipEnd < confEnd) {
              // VIP in middle -> Adjust existing end to vipStart
              await supabase
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

    // 4. Batch Upsert (Insert or Update)
    const toInsert = validReservations.map((r) => ({
      ...(r.id ? { id: r.id } : {}), // Only include ID if it exists
      title: r.title,
      start_time: r.start_time,
      end_time: r.end_time,
      user_id: r.user_id,
      auditorium_id: r.auditorium_id || "1",
      resources: r.resources || [], // Ensure array
      description: r.description || null,
      status: initialStatus,
    }));

    const { data: result, error } = await supabase
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
        const { data: userRaw } = await supabase
          .from("users")
          .select("full_name, email, employment_type, username, id")
          .eq("id", validReservations[0].user_id)
          .single();

        if (!userRaw)
          throw new Error("Usuario no encontrado para notificación");
        const user = userRaw;

        const isLibrary = validReservations.some(
          (r) => String(r.auditorium_id) === "3",
        );
        const isMultiDay = validReservations.length > 1;

        // Regla de Negocio:
        // - Funcionarios/Planta -> Siempre @sena.edu.co (basado en username)
        const employmentType = (user.employment_type || "").toLowerCase();
        const isOfficial =
          employmentType.includes("planta") ||
          employmentType.includes("funcionario") ||
          employmentType.includes("oficial");

        let recipientEmail = user.email;
        if (isOfficial) {
          recipientEmail = `${user.username.trim()}@sena.edu.co`.toLowerCase();
        }

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

        // A. Library Batch Notification
        if (isLibrary) {
          const coordinatorSubject =
            initialStatus === "PENDING"
              ? `Solicitud de Reserva Biblioteca (Grupal): ${titles[0]}`
              : `Reserva Grupal VIP Aprobada (Cuentadante): ${titles[0]}`;

          await EmailService.send({
            to: "egutierrezn@sena.edu.co",
            subject: coordinatorSubject,
            react: SupportNotification({
              requesterName: user.full_name,
              requesterEmail: recipientEmail || user.email || undefined,
              eventTitle: `${titles[0]} (Lote de ${validReservations.length} días)`,
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

          if (initialStatus === "PENDING") {
            revalidatePath("/dashboard");
            return { success: true, data: result, pendingApproval: true };
          }
        }

        // B. Default confirmation check
        if (recipientEmail && recipientEmail.includes("@")) {
          const emailSubject = isMultiDay
            ? `Reserva Grupal Confirmada: ${titles[0]}`
            : `Reserva Confirmada: ${titles[0]}`;

          const eventTitleDisplay = isMultiDay
            ? `${titles[0]} (Lote de ${validReservations.length} días)`
            : titles[0];

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
          const timeStr = `${new Date(first.start_time).toLocaleTimeString(
            "es-CO",
            {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Bogota",
            },
          )} - ${new Date(first.end_time).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
          })}`;

          await EmailService.send({
            to: recipientEmail,
            subject: emailSubject,
            react: ReservationConfirmation({
              userName: user.full_name,
              eventTitle: eventTitleDisplay,
              date: datesList,
              timeRange: timeStr,
              location: isLibrary
                ? "Biblioteca"
                : validReservations.some((r) => String(r.auditorium_id) === "2")
                  ? "Subdirección"
                  : "Auditorio Principal",
              resources: first.resources || [],
              specialRequirements: first.description,
            }),
          });

          // Coordinator summary - ONLY IF description matches search rule
          const allDescriptions = validReservations
            .map((r) => r.description)
            .filter((d) => d && d.trim().length > 0);

          if (allDescriptions.length > 0) {
            await EmailService.send({
              to: "jeavendano@sena.edu.co",
              subject: `⚠️ Múltiples Requerimientos: ${titles[0]}`,
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
