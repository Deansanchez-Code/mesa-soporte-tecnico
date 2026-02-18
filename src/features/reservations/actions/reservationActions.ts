"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EmailService } from "@/lib/email/email-service";
import ReservationConfirmation from "@/lib/email/templates/ReservationConfirmation";
import SupportNotification from "@/lib/email/templates/SupportNotification";
import VipCancellation from "@/lib/email/templates/VipCancellation";
import { ReservationSchema } from "../schemas";
import Logger from "@/lib/logger";

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
      try {
        // Fetch full victim user details
        const { data: victim } = await supabase
          .from("users")
          .select("full_name, email, employment_type, username")
          .eq("id", reservation.user_id)
          .single();

        if (victim) {
          let recipientEmail = victim.email;

          // Regla de Negocio:
          // - Funcionarios/Planta -> Siempre @sena.edu.co (basado en username)
          // - Contratistas -> Correo registrado (personal o corporativo)
          const employmentType = (victim.employment_type || "").toLowerCase();
          const isOfficial =
            employmentType.includes("planta") ||
            employmentType.includes("funcionario") ||
            employmentType.includes("oficial");

          if (isOfficial) {
            recipientEmail =
              `${victim.username.trim()}@sena.edu.co`.toLowerCase();
          }

          if (recipientEmail && recipientEmail.includes("@")) {
            const dateStr = new Date(reservation.start_time).toLocaleDateString(
              "es-CO",
            );

            // 1. Notify Victim
            await EmailService.send({
              to: recipientEmail,
              subject: `⚠️ Cancelación por Prioridad: ${reservation.title}`,
              react: VipCancellation({
                userName: victim.full_name,
                eventTitle: reservation.title,
                date: dateStr,
                cancelledBy: publicUser?.full_name || "Usuario VIP",
              }),
            });

            // 2. Notify Coordinator IF it had Special Requirements
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
      // --- AUTOMATIC TICKET RESOLUTION ---
      try {
        // Identify the associated ticket
        const { data: tickets } = await supabase
          .from("tickets")
          .select("id")
          .eq("user_id", reservation.user_id)
          .eq("category", "Reserva Auditorio")
          .ilike("description", `%${reservation.title}%`)
          .neq("status", "RESUELTO")
          .order("created_at", { ascending: false })
          .limit(1);

        if (tickets && tickets.length > 0) {
          await supabase
            .from("tickets")
            .update({
              status: "RESUELTO",
              solution: "Cancelado por el usuario y resuelto por el Superadmin",
              sla_status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", tickets[0].id);
        }
      } catch (e) {
        console.error("Auto Ticket Resolution Error: ", e);
      }
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
      .select("id, role, employment_type, email, username")
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

    // 3. Conflict Check (Scoped to specific space)
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("status", "APPROVED")
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
          status: "APPROVED",
        },
      ])
      .select("*, users(full_name, email, employment_type, username)")
      .single();

    if (error) throw error;

    // --- NOTIFICATION LOGIC ---
    try {
      const reservation = result;
      const user = reservation.users;

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
        });
        const timeStr = `${startDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;

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
          }),
        });
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
      console.error("Single Reservation Email Error:", emailErr);
    }

    revalidatePath("/dashboard");
    return { success: true, data: result };
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
      .eq("status", "APPROVED")
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
    const { data: publicUser, error: userError } = await supabase
      .from("users")
      .select("id, role, is_vip, full_name, employment_type, email")
      .eq("auth_id", authUser.id)
      .single();

    if (userError || !publicUser)
      throw new Error("Usuario no encontrado en base de datos");

    const isVip =
      !!publicUser.is_vip || publicUser.role?.toLowerCase() === "vip";
    const isAdmin = ["admin", "superadmin"].includes(
      publicUser.role?.toLowerCase() || "",
    );

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
      validReservations.push(data);
    }

    // 3. Global Conflict Check and RBAC
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
        const isAllowed = [
          "egutierrezn@sistema.local",
          "rbiblioteca@sistema.local",
        ].includes(userEmail);

        if (!isAllowed && !isAdmin) {
          throw new Error(
            `No tienes permisos para reservar la Biblioteca (detectado en fecha ${new Date(res.start_time).toLocaleDateString()}).`,
          );
        }
      }

      // Conflict Check (Scoped to space)
      let query = supabase
        .from("reservations")
        .select("*, users(id, full_name, is_vip, role)") // Select user details to check their status
        .eq("status", "APPROVED")
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const conflictUser = (c as any).users;
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

          // Atomic Cancellation of Conflicts
          for (const conflict of conflicts) {
            await cancelReservationAction(conflict.id); // Re-use existing action to handle notifications/emails
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
      status: "APPROVED",
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
        const { data: user } = await supabase
          .from("users")
          .select("full_name, email, employment_type, username")
          .eq("id", validReservations[0].user_id)
          .single();

        if (!user) throw new Error("Usuario no encontrado para notificación");

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
          const titles = [...new Set(validReservations.map((r) => r.title))];
          const isSingleActivity = titles.length === 1;

          if (isSingleActivity) {
            // GROUPED EMAIL (Multi-day)
            const sortedRes = [...validReservations].sort(
              (a, b) =>
                new Date(a.start_time).getTime() -
                new Date(b.start_time).getTime(),
            );

            const datesList = sortedRes
              .map((r) => {
                const d = new Date(r.start_time);
                return d.toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "short",
                });
              })
              .join(", ");

            const first = sortedRes[0];
            const timeStr = `${new Date(first.start_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} - ${new Date(first.end_time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;

            await EmailService.send({
              to: recipientEmail,
              subject: `Reserva Grupal Confirmada: ${titles[0]}`,
              react: ReservationConfirmation({
                userName: user.full_name,
                eventTitle: `${titles[0]} (Lote de ${validReservations.length} días)`,
                date: datesList,
                timeRange: timeStr,
                location: "Auditorio Principal",
                resources: first.resources || [],
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
                  specialRequirements: [...new Set(allDescriptions)].join(
                    " | ",
                  ),
                  type: "NEW_REQUIREMENT",
                }),
              });
            }
          } else {
            // Individual fallback (Optional: just in case titles differ in a batch)
            // For brevity, usually batch reservations from UI have same title.
          }
        }
      }
    } catch (err) {
      console.error("Batch Email Error:", err);
    }

    revalidatePath("/dashboard");
    return { success: true, data: result };
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
