"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { EmailService } from "@/lib/email/email-service";
import { SpaceReservationEmail } from "@/lib/email/templates/SpaceReservationEmail";
import Logger from "@/lib/logger";
import {
  isUserSpaceCoordinator,
  getSpaceCoordinator,
} from "./reservationActions";

const ALLOWED_107_APPROVERS = [
  "nbarrerac@sena.edu.co",
  "nbarrerac",
  "dasanchezh@sena.edu.co", // Admin backup
  "dasanchezh",
];

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

async function verifyAmbiente107Coordinator(spaceId?: string | number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // ISO 27001 A.8.2: Autorización únicamente desde tabla autoritativa en DB (nunca user_metadata)
  const supabaseAdmin = getSupabaseAdmin();
  const { data: publicUser } = await supabaseAdmin
    .from("users")
    .select("username, email, role, job_category, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!publicUser || publicUser.is_active === false) {
    throw new Error("Usuario inactivo o no autorizado");
  }

  const email = (publicUser.email || user.email || "").toLowerCase();
  const username = (publicUser.username || "").toLowerCase().trim();
  const role = (publicUser.role || "").toLowerCase();
  const jobCategory = (publicUser.job_category || "").toLowerCase();

  if (
    role === "admin" ||
    role === "superadmin" ||
    username === "dasanchezh" ||
    email.includes("dasanchezh")
  ) {
    return { isSuperAdmin: true, allowedSpaces: ["4", "5"] };
  }

  const isCoord4 = await isUserSpaceCoordinator(username, email, "4");
  const isCoord5 = await isUserSpaceCoordinator(username, email, "5");

  const isExplicitAllowed = ALLOWED_107_APPROVERS.some(
    (allowed) =>
      email.includes(allowed.toLowerCase()) ||
      username.includes(allowed.toLowerCase()),
  );

  const allowedSpaces: string[] = [];
  if (isCoord4 || isExplicitAllowed) allowedSpaces.push("4");
  if (isCoord5 || isExplicitAllowed) allowedSpaces.push("5");
  if (role === "coordinator" || jobCategory === "coordinador") {
    if (!allowedSpaces.includes("4")) allowedSpaces.push("4");
    if (!allowedSpaces.includes("5")) allowedSpaces.push("5");
  }

  if (spaceId && !allowedSpaces.includes(String(spaceId))) {
    throw new Error(
      `No autorizado para gestionar reservas del espacio ${spaceId}`,
    );
  }

  if (allowedSpaces.length === 0) {
    throw new Error(
      "No autorizado para gestionar reservas de Ambiente 107 / Cocina",
    );
  }

  return { isSuperAdmin: false, allowedSpaces };
}

interface ReservationData {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  user_id: string;
  auditorium_id: string | number;
  users: {
    full_name: string;
    email: string;
  };
}

/**
 * Consulta todas las solicitudes pendientes vigentes de los ambientes autorizados (107 / Cocina)
 */
export async function getPendingAmbiente107Reservations() {
  try {
    const { allowedSpaces } = await verifyAmbiente107Coordinator();
    const supabaseAdmin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("reservations")
      .select(
        `
        id, 
        title, 
        start_time, 
        end_time, 
        user_id,
        auditorium_id,
        users(full_name, email)
      `,
      )
      .in("auditorium_id", allowedSpaces)
      .eq("status", "PENDING")
      .gte("end_time", nowIso)
      .order("start_time", { ascending: true });

    if (error) throw error;

    return ((data as unknown as ReservationData[]) || []).map((res) => {
      const start = new Date(res.start_time);
      const end = new Date(res.end_time);
      const durationHours =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      return {
        id: res.id,
        title: res.title,
        start_time: res.start_time,
        end_time: res.end_time,
        user_id: res.user_id,
        auditorium_id: String(res.auditorium_id),
        spaceName:
          String(res.auditorium_id) === "5"
            ? "Ambiente de Cocina"
            : "Ambiente 107",
        users: res.users,
        durationHours: Math.round(durationHours * 10) / 10,
      };
    });
  } catch (error) {
    console.error(
      "Error fetching pending Ambiente 107/Cocina reservations:",
      error,
    );
    return [];
  }
}

/**
 * Aprueba una solicitud de reserva del Ambiente 107 y envía correo humanizado al usuario
 */
export async function approveAmbiente107Reservation(id: number) {
  try {
    await verifyAmbiente107Coordinator();
    const supabaseAdmin = getSupabaseAdmin();
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select(
        "*, users(full_name, email, username, employment_type, job_category)",
      )
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

    await verifyAmbiente107Coordinator(reservation.auditorium_id);
    const coordinator = await getSpaceCoordinator(reservation.auditorium_id);

    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update({ status: "APPROVED" })
      .eq("id", id);

    if (updateError) throw updateError;

    // Destinatario y correo institucional del funcionario/instructor que queda con la reserva
    const user = (
      reservation as unknown as {
        users: {
          full_name: string;
          email: string;
          username: string;
          employment_type: string;
          job_category?: string;
        };
      }
    ).users;

    const recipientEmail = resolveReservationUserEmail(user);

    const spaceLabel =
      String(reservation.auditorium_id) === "5"
        ? "Ambiente de Cocina"
        : "Ambiente 107";

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

    if (recipientEmail && recipientEmail.includes("@")) {
      await EmailService.send({
        to: recipientEmail,
        subject: `¡Reserva Confirmada! ${spaceLabel}: ${reservation.title}`,
        react: SpaceReservationEmail({
          spaceName: spaceLabel,
          requesterName: user.full_name,
          eventTitle: reservation.title,
          date: dateStr,
          timeRange: timeStr,
          specialRequirements: reservation.description || "Ninguno",
          coordinatorName: coordinator.full_name,
          type: "APPROVED",
        }),
      });
    }

    // In-App Notification
    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "¡Reserva Aprobada! 🎉",
        message: `Tu reserva para el ${spaceLabel} ("${reservation.title}" - ${dateStr}) ha sido autorizada por ${coordinator.full_name}.`,
      },
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al aprobar";
    Logger.error("[Ambiente107] Error approving reservation:", error);
    return { success: false, error: msg };
  }
}

/**
 * Cancela/Rechaza la solicitud de reserva del Ambiente 107 con motivo humanizado
 */
export async function cancelAmbiente107Reservation(id: number, reason: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select(
        "*, users(full_name, email, username, employment_type, job_category)",
      )
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

    await verifyAmbiente107Coordinator(reservation.auditorium_id);
    const coordinator = await getSpaceCoordinator(reservation.auditorium_id);

    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", id);

    if (updateError) throw updateError;

    const user = (
      reservation as unknown as {
        users: {
          full_name: string;
          email: string;
          username: string;
          employment_type: string;
          job_category?: string;
        };
      }
    ).users;

    const recipientEmail = resolveReservationUserEmail(user);
    const spaceLabel =
      String(reservation.auditorium_id) === "5"
        ? "Ambiente de Cocina"
        : "Ambiente 107";
    const dateFormatted = new Date(reservation.start_time).toLocaleDateString(
      "es-CO",
      {
        timeZone: "America/Bogota",
      },
    );

    if (recipientEmail && recipientEmail.includes("@")) {
      await EmailService.send({
        to: recipientEmail,
        subject: `Reserva ${spaceLabel} No Confirmada: ${reservation.title}`,
        react: SpaceReservationEmail({
          spaceName: spaceLabel,
          requesterName: user.full_name,
          eventTitle: reservation.title,
          date: dateFormatted,
          timeRange: "N/A",
          specialRequirements: reason,
          coordinatorName: coordinator.full_name,
          type: "CANCELLED",
        }),
      });
    }

    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Reserva No Confirmada ❌",
        message: `Tu solicitud para el ${spaceLabel} (${dateFormatted}) no pudo ser autorizada por ${coordinator.full_name}. Motivo: ${reason}`,
      },
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al cancelar";
    Logger.error("[Ambiente107] Error cancelling reservation:", error);
    return { success: false, error: msg };
  }
}

/**
 * Sugerencia de modificación para el usuario
 */
export async function suggestModification107Action(
  id: number,
  suggestion: string,
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select(
        "*, users(full_name, email, username, employment_type, job_category)",
      )
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

    await verifyAmbiente107Coordinator(reservation.auditorium_id);
    const coordinator = await getSpaceCoordinator(reservation.auditorium_id);

    const user = (
      reservation as unknown as {
        users: {
          full_name: string;
          email: string;
          username: string;
          employment_type: string;
          job_category?: string;
        };
      }
    ).users;

    const recipientEmail = resolveReservationUserEmail(user);
    const spaceLabel =
      String(reservation.auditorium_id) === "5"
        ? "Ambiente de Cocina"
        : "Ambiente 107";
    const dateFormatted = new Date(reservation.start_time).toLocaleDateString(
      "es-CO",
      {
        timeZone: "America/Bogota",
      },
    );

    if (recipientEmail && recipientEmail.includes("@")) {
      await EmailService.send({
        to: recipientEmail,
        subject: `Sugerencia sobre tu reserva de ${spaceLabel}: ${reservation.title}`,
        react: SpaceReservationEmail({
          spaceName: spaceLabel,
          requesterName: user.full_name,
          eventTitle: reservation.title,
          date: dateFormatted,
          timeRange: "N/A",
          specialRequirements: suggestion,
          coordinatorName: coordinator.full_name,
          type: "MODIFICATION_SUGGESTED",
        }),
      });
    }

    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Ajuste Sugerido en Reserva 💡",
        message: `${coordinator.full_name} sugiere un ajuste para tu reserva de ${spaceLabel} (${dateFormatted}): "${suggestion}"`,
      },
    ]);

    return { success: true };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error al enviar sugerencia";
    Logger.error("[Ambiente107] Error suggesting modification:", error);
    return { success: false, error: msg };
  }
}
