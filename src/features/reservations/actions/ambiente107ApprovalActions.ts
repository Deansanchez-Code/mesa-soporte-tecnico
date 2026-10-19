"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { EmailService } from "@/lib/email/email-service";
import { SpaceReservationEmail } from "@/lib/email/templates/SpaceReservationEmail";
import Logger from "@/lib/logger";

const ALLOWED_107_APPROVERS = [
  "nbarrerac@sena.edu.co",
  "nbarrerac",
  "dasanchezh@sena.edu.co", // Admin backup
  "dasanchezh",
];

async function verifyAmbiente107Coordinator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const email = (user.email || "").toLowerCase();
  const username = (
    (user.user_metadata?.username as string) || ""
  ).toLowerCase();
  const role = (user.user_metadata?.role || "").toLowerCase();

  const isExplicitAllowed = ALLOWED_107_APPROVERS.some(
    (allowed) =>
      email.includes(allowed.toLowerCase()) ||
      username.includes(allowed.toLowerCase()),
  );

  if (!isExplicitAllowed && role !== "admin" && role !== "superadmin") {
    throw new Error("No autorizado para gestionar reservas del Ambiente 107");
  }
}

interface ReservationData {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  user_id: string;
  users: {
    full_name: string;
    email: string;
  };
}

/**
 * Consulta todas las solicitudes pendientes del Ambiente 107 (Space ID 4)
 */
export async function getPendingAmbiente107Reservations() {
  try {
    await verifyAmbiente107Coordinator();
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("reservations")
      .select(
        `
        id, 
        title, 
        start_time, 
        end_time, 
        user_id,
        users(full_name, email)
      `,
      )
      .eq("auditorium_id", "4")
      .eq("status", "PENDING")
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
        users: res.users,
        durationHours: Math.round(durationHours * 10) / 10,
      };
    });
  } catch (error) {
    console.error("Error fetching pending Ambiente 107 reservations:", error);
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
      .select("*, users(full_name, email, username, employment_type)")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update({ status: "APPROVED" })
      .eq("id", id);

    if (updateError) throw updateError;

    // Destinatario y correo institucional
    const user = (
      reservation as unknown as {
        users: {
          full_name: string;
          email: string;
          username: string;
          employment_type: string;
        };
      }
    ).users;

    const isOfficial =
      user.employment_type?.toLowerCase().includes("planta") ||
      user.employment_type?.toLowerCase().includes("funcionario");

    let recipientEmail = user.email;
    if (isOfficial && user.username) {
      recipientEmail = `${user.username.trim()}@sena.edu.co`.toLowerCase();
    }

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

    await EmailService.send({
      to: recipientEmail,
      subject: `¡Reserva Confirmada! Ambiente 107: ${reservation.title}`,
      react: SpaceReservationEmail({
        spaceName: "Ambiente 107",
        requesterName: user.full_name,
        eventTitle: reservation.title,
        date: dateStr,
        timeRange: timeStr,
        specialRequirements: reservation.description || "Ninguno",
        coordinatorName: "Norma Barrera",
        type: "APPROVED",
      }),
    });

    // In-App Notification
    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "¡Reserva Aprobada! 🎉",
        message: `Tu reserva para el Ambiente 107 ("${reservation.title}") ha sido autorizada por Norma Barrera.`,
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
    await verifyAmbiente107Coordinator();
    const supabaseAdmin = getSupabaseAdmin();
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select("*, users(full_name, email, username, employment_type)")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

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
        };
      }
    ).users;

    const recipientEmail = user.email;

    await EmailService.send({
      to: recipientEmail,
      subject: `Reserva Ambiente 107 No Confirmada: ${reservation.title}`,
      react: SpaceReservationEmail({
        spaceName: "Ambiente 107",
        requesterName: user.full_name,
        eventTitle: reservation.title,
        date: new Date(reservation.start_time).toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
        }),
        timeRange: "N/A",
        specialRequirements: reason,
        coordinatorName: "Norma Barrera",
        type: "CANCELLED",
      }),
    });

    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Reserva No Confirmada ❌",
        message: `Tu solicitud para el Ambiente 107 no pudo ser autorizada. Motivo: ${reason}`,
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
    await verifyAmbiente107Coordinator();
    const supabaseAdmin = getSupabaseAdmin();
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select("*, users(full_name, email, username, employment_type)")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

    const user = (
      reservation as unknown as {
        users: {
          full_name: string;
          email: string;
          username: string;
          employment_type: string;
        };
      }
    ).users;

    await EmailService.send({
      to: user.email,
      subject: `Sugerencia sobre tu reserva de Ambiente 107: ${reservation.title}`,
      react: SpaceReservationEmail({
        spaceName: "Ambiente 107",
        requesterName: user.full_name,
        eventTitle: reservation.title,
        date: new Date(reservation.start_time).toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
        }),
        timeRange: "N/A",
        specialRequirements: suggestion,
        coordinatorName: "Norma Barrera",
        type: "MODIFICATION_SUGGESTED",
      }),
    });

    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Ajuste Sugerido en Reserva 💡",
        message: `Norma Barrera sugiere un ajuste para tu reserva de Ambiente 107: "${suggestion}"`,
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
