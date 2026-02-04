"use server";

import { createClient } from "@/lib/supabase/servidor";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EmailService } from "@/lib/email/email-service";
import ReservationConfirmation from "@/lib/email/templates/ReservationConfirmation";
import SupportNotification from "@/lib/email/templates/SupportNotification";
import VipCancellation from "@/lib/email/templates/VipCancellation";

import { ReservationSchema } from "../schemas";

// Removed inline schema definition to comply with "use server" rules

export async function cancelReservationAction(reservationId: number) {
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
      .select("id, is_vip, role, full_name") // Added full_name for email
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

    // 6. Notify Owner if VIP Override (Smart Dispatch)
    if (!isOwner && isVip) {
      // Insert internal notification
      await supabase.from("user_notifications").insert([
        {
          user_id: reservation.user_id,
          title: "Reserva Cancelada por Prioridad",
          message: `Tu reserva "${reservation.title}" para el ${new Date(reservation.start_time).toLocaleString()} ha sido cancelada por un usuario VIP.`,
        },
      ]);

      // --- EMAIL DISPATCH ---
      (async () => {
        try {
          // Fetch full victim user details
          const { data: victim } = await supabase
            .from("users")
            .select("full_name, email, employment_type, username")
            .eq("id", reservation.user_id)
            .single();

          if (victim) {
            // Determine Recipient (Same Logic)
            let recipientEmail = victim.email;
            if (
              victim.employment_type !== "CONTRATISTA" &&
              victim.employment_type !== "APRENDIZ"
            ) {
              if (!recipientEmail || !recipientEmail.includes("@")) {
                recipientEmail =
                  `${victim.username.trim()}@sena.edu.co`.toLowerCase();
              }
            }

            if (recipientEmail && recipientEmail.includes("@")) {
              const dateStr = new Date(
                reservation.start_time,
              ).toLocaleDateString("es-CO");

              // 1. Notify Victim
              await EmailService.send({
                to: recipientEmail,
                subject: `⚠️ Cancelación por Prioridad: ${reservation.title}`,
                react: VipCancellation({
                  userName: victim.full_name,
                  eventTitle: reservation.title,
                  date: dateStr,
                  cancelledBy: publicUser?.full_name || "Usuario VIP", // Assuming publicUser has full_name, might need fetch
                }),
              });

              // 2. Notify Coordinator IF it had Special Requirements (Cleanup)
              // Need to fetch description from reservation? We queried it in line 31? No, we queried user_id, start_time, title.
              // Let's optimize: We need description to check this rule.
              // We'll trust the flow or re-fetch if needed. Ideally line 31 should have select("..., description").

              // Re-fetching strictly for this rule to ensure data integrity
              const { data: resDetails } = await supabase
                .from("reservations")
                .select("description")
                .eq("id", reservationId)
                .single();

              if (
                resDetails?.description &&
                resDetails.description.trim().length > 0
              ) {
                await EmailService.send({
                  to: "jeavendano@sena.edu.co",
                  subject: `🚫 Requerimiento Cancelado: ${reservation.title}`,
                  react: SupportNotification({
                    requesterName: victim.full_name,
                    eventTitle: reservation.title,
                    date: dateStr,
                    timeRange: "CANCELADO",
                    specialRequirements: resDetails.description,
                    type: "CANCELLED_REQUIREMENT",
                    cancelledBy: publicUser?.full_name || "Prioridad VIP",
                  }),
                });
              }
            }
          }
        } catch (e) {
          console.error("VIP Cancel Email Error: ", e);
        }
      })();
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Error al cancelar la reserva";
    return { error: errorMsg };
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
    const { data: publicUser } = await supabase
      .from("users")
      .select("id, role, employment_type, email")
      .eq("auth_id", authUser.id)
      .single();

    if (publicUser?.id !== user_id) {
      const isAdmin = ["admin", "superadmin"].includes(
        publicUser?.role?.toLowerCase() || "",
      );
      if (!isAdmin)
        throw new Error(
          "No tienes permisos para crear reservas a nombre de otros",
        );
    }

    // 3. Conflict Check
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("status", "APPROVED")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      throw new Error("Horario no disponible (conflicto detectado)");
    }

    // 4. Insert
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
          status: "APPROVED",
        },
      ])
      .select("*, users(full_name, email, employment_type, username)") // Join to get up-to-date user info for email
      .single();

    if (error) throw error;

    // --- NOTIFICATION LOGIC (SMART DISPATCH) ---
    // Non-blocking catch to prevent transaction failure if email fails
    (async () => {
      try {
        const reservation = result;
        const user = reservation.users; // joined data

        // A. Determine Recipient Email
        let recipientEmail = user.email; // Default fallback
        if (
          user.employment_type === "CONTRATISTA" ||
          user.employment_type === "APRENDIZ"
        ) {
          // Keep personal email from DB
        } else {
          // Planta / Official: Try to construct or use institutional
          // If the DB email is NOT sena.edu.co, we might want to use the computed one?
          // For now, let's trust the DB email if valid, or fallback to username schema if missing
          if (!recipientEmail || !recipientEmail.includes("@")) {
            recipientEmail =
              `${user.username.trim()}@sena.edu.co`.toLowerCase();
          }
        }

        // Ensure we have a valid email to send to
        if (recipientEmail && recipientEmail.includes("@")) {
          const startDate = new Date(reservation.start_time);
          const endDate = new Date(reservation.end_time);
          const dateStr = startDate.toLocaleDateString("es-CO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const timeStr = `${startDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;

          // Calculate Google Calendar Link (Basic)
          const gCalStart = startDate
            .toISOString()
            .replace(/-|:|\.\d\d\d/g, "");
          const gCalEnd = endDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
          const gLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reservation.title)}&dates=${gCalStart}/${gCalEnd}&details=${encodeURIComponent(reservation.description || "")}&location=Auditorio+SENA`;

          // 1. Send Confirmation to User
          await EmailService.send({
            to: recipientEmail,
            subject: `Reserva Confirmada: ${reservation.title}`,
            react: ReservationConfirmation({
              userName: user.full_name,
              eventTitle: reservation.title,
              date: dateStr,
              timeRange: timeStr,
              location: "Auditorio Principal",
              resources: reservation.resources || [],
              calendarLink: gLink,
            }),
          });

          // 2. Send Notification to Coordinator IF Special Requirements exist
          if (
            reservation.description &&
            reservation.description.trim().length > 0
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
        console.error("Smart Dispatch Error:", emailErr);
        // Do not throw, keep reservation success
      }
    })();

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    const errorMsg =
      (error as Record<string, unknown>)?.message ||
      (typeof error === "object"
        ? JSON.stringify(error)
        : String(error || "Error al crear reserva"));
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
      .select("id, is_vip, role")
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

    // 3. Conflict Check (excluding current ID)
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("status", "APPROVED")
      .neq("id", id)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      throw new Error("Horario no disponible (conflicto detectado)");
    }

    // 4. Update
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
    return { error: String(errorMsg) };
  }
}

export async function createReservationBatchAction(
  reservations: z.infer<typeof ReservationSchema>[],
) {
  try {
    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    // 2. Permissions Check
    const { data: publicUser, error: userError } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();

    if (userError || !publicUser)
      throw new Error("Usuario no encontrado en base de datos");

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
        const isAdmin = ["admin", "superadmin"].includes(
          publicUser.role?.toLowerCase() || "",
        );
        if (!isAdmin)
          throw new Error(
            "No tienes permisos para crear reservas a nombre de otros",
          );
      }
      validReservations.push(data);
    }

    // 3. Global Conflict Check (Atomic-like)
    // We avoid joining users here to prevent RLS/Relation errors causing 500s.
    for (const res of validReservations) {
      const { data: conflicts, error: conflictError } = await supabase
        .from("reservations")
        .select("id")
        .eq("status", "APPROVED")
        .lt("start_time", res.end_time)
        .gt("end_time", res.start_time);

      if (conflictError) {
        console.error("Error checking conflicts:", conflictError);
        throw new Error("Error verificando disponibilidad de horario");
      }

      if (conflicts && conflicts.length > 0) {
        // We found a conflict.
        throw new Error(
          `Conflicto detectado para el ${new Date(res.start_time).toLocaleDateString()} (se solapa con otra reserva)`,
        );
      }
    }

    // 4. Batch Insert
    const toInsert = validReservations.map((r) => ({
      title: r.title,
      start_time: r.start_time,
      end_time: r.end_time,
      user_id: r.user_id,
      auditorium_id: r.auditorium_id || "1",
      resources: r.resources || [], // Ensure array
      description: r.description || null,
      status: "APPROVED",
    }));

    const { data: result, error } = await supabase
      .from("reservations")
      .insert(toInsert)
      .select();

    if (error) {
      console.error("Error inserting reservations:", error);
      throw new Error(error.message || "Error al insertar reservas");
    }

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("Server Action Error (createReservationBatchAction):", error);
    const errorMsg =
      (error as Record<string, unknown>)?.message ||
      (typeof error === "object"
        ? JSON.stringify(error)
        : String(error || "Error en creación masiva"));
    return { error: String(errorMsg) };
  }
}
