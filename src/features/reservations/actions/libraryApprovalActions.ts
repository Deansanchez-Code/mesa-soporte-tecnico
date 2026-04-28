"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { EmailService } from "@/lib/email/email-service";
import { LibraryNotification } from "@/lib/email/templates/LibraryNotification";
import Logger from "@/lib/logger";

async function verifyLibraryCoordinator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const email = (user.email || "").toLowerCase();
  const role = (user.user_metadata?.role || "").toLowerCase();
  const allowed = [
    "dasanchezh@sena.edu.co",
    "egutierrezn@sena.edu.co",
    "egutierrezn@sistema.local",
    "emgutierrezn@sena.edu.co",
    "emgutierrezn@sistema.local",
  ];

  if (!allowed.includes(email) && role !== "admin" && role !== "superadmin") {
    throw new Error("No autorizado para gestionar reservas de biblioteca");
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
 * Fetches all pending library reservations (Space ID 3)
 */
export async function getPendingLibraryReservations() {
  try {
    await verifyLibraryCoordinator();
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
      .eq("auditorium_id", "3")
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
    console.error("Error fetching pending reservations:", error);
    return [];
  }
}

/**
 * Approves a reservation and notifies the user
 */
export async function approveLibraryReservation(id: number) {
  try {
    await verifyLibraryCoordinator();
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

    // Send Confirmation Email to User
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
      await EmailService.send({
        to: recipientEmail,
        subject: `Reserva Aprobada: ${reservation.title}`,
        react: LibraryNotification({
          requesterName: user.full_name,
          eventTitle: reservation.title,
          date: new Date(reservation.start_time).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
            timeZone: "America/Bogota",
          }),
          timeRange: `${new Date(reservation.start_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })} - ${new Date(reservation.end_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}`,
          specialRequirements: reservation.description || "Ninguno",
          type: "APPROVED",
        }),
      });
    }

    // Insert In-App Notification
    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Reserva Aprobada ✅",
        message: `Tu reserva de biblioteca "${reservation.title}" para el ${new Date(reservation.start_time).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })} ha sido autorizada.`,
      },
    ]);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    await Logger.error("Library Approval Error", { error: err });
    return { success: false, error: err.message };
  }
}

/**
 * Cancels a reservation with a reason and notifies the user
 */
export async function cancelLibraryReservation(id: number, reason: string) {
  try {
    await verifyLibraryCoordinator();
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

    // Notify User about cancellation
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
    const recipientEmail = user.email; // Usually fallback to registered email for cancellations

    await EmailService.send({
      to: recipientEmail,
      subject: `Reserva de Biblioteca Cancelada: ${reservation.title}`,
      react: LibraryNotification({
        requesterName: user.full_name,
        eventTitle: `CANCELADA: ${reservation.title}`,
        date: new Date(reservation.start_time).toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
        }),
        timeRange: "N/A",
        specialRequirements: `Motivo de la cancelación: ${reason}`,
        type: "CANCELLED",
      }),
    });

    // Insert In-App Notification
    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Reserva Cancelada ❌",
        message: `Tu reserva de biblioteca "${reservation.title}" ha sido cancelada. Motivo: ${reason}`,
      },
    ]);

    // --- AUTOMATIC TICKET CANCELLATION (soft update, no hard delete) ---
    try {
      // Identify the associated ticket
      const { data: tickets } = await supabaseAdmin
        .from("tickets")
        .select("id, description")
        .eq("user_id", reservation.user_id)
        .ilike("description", `%${reservation.title}%`)
        .not("status", "in", '("CANCELADO","CERRADO","RESUELTO")')
        .order("created_at", { ascending: false })
        .limit(1);

      if (tickets && tickets.length > 0) {
        const ticketId = tickets[0].id;
        const cancelNote = `Cancelado por coordinador de biblioteca. Motivo: ${reason}`;
        const dateStr = new Date().toLocaleString("es-CO", {
          timeZone: "America/Bogota",
        });
        const updatedDescription = `${tickets[0].description || ""}\n\n[${dateStr}] CANCELACIÓN AUTOMÁTICA: ${cancelNote}.`;

        await supabaseAdmin
          .from("tickets")
          .update({
            status: "CANCELADO",
            description: updatedDescription,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticketId);
      }
    } catch (e) {
      console.error("Auto Ticket Cancellation Error: ", e);
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Requests a modification (Notifies user but keeps PENDING)
 */
export async function requestModificationAction(
  id: number,
  suggestion: string,
) {
  try {
    await verifyLibraryCoordinator();
    const supabaseAdmin = getSupabaseAdmin();
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select("*, users(full_name, email)")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new Error("Reserva no encontrada");

    const user = (
      reservation as unknown as { users: { full_name: string; email: string } }
    ).users;

    // Notify User with a Suggestion
    await EmailService.send({
      to: user.email,
      subject: `Sugerencia de Modificación para Reserva: ${reservation.title}`,
      react: LibraryNotification({
        requesterName: user.full_name,
        eventTitle: `MODIFICACIÓN REQUERIDA: ${reservation.title}`,
        date: new Date(reservation.start_time).toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
        }),
        timeRange: "Revisar Sugerencia",
        specialRequirements: suggestion,
        type: "MODIFICATION_SUGGESTED",
      }),
    });

    // Insert In-App Notification
    await supabaseAdmin.from("user_notifications").insert([
      {
        user_id: reservation.user_id,
        title: "Modificación Sugerida ⚠️",
        message: `Se sugiere una modificación para tu reserva "${reservation.title}": ${suggestion}`,
      },
    ]);

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
