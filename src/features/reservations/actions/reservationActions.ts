"use server";

import { createClient } from "@/lib/supabase/servidor";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ReservationSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  user_id: z.string().uuid(),
  auditorium_id: z.string().optional(),
  resources: z.array(z.string()).optional().nullable(),
  description: z.string().optional().nullable(),
});

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
      .select("id, is_vip, role")
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

    // 6. Notify Owner if VIP Override
    if (!isOwner && isVip) {
      await supabase.from("user_notifications").insert([
        {
          user_id: reservation.user_id,
          title: "Reserva Cancelada por Prioridad",
          message: `Tu reserva "${reservation.title}" para el ${new Date(reservation.start_time).toLocaleString()} ha sido cancelada por un usuario VIP.`,
        },
      ]);
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

    // 2. Permissions Check
    const { data: publicUser } = await supabase
      .from("users")
      .select("id, role")
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
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : String(error || "Error al crear reserva"),
    };
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

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : String(error || "Error al actualizar reserva"),
    };
  }
}
