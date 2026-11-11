"use server";

import { createClient } from "@/lib/supabase/server";
import { ReservationNotificationService } from "../services/reservationNotificationService";
import {
  handleActionError,
  createActionResponse,
} from "@/lib/server-action-utils";

/**
 * Acción de servidor para procesar notificaciones de reserva.
 * Requiere sesión autenticada válida.
 */
export async function processReservationNotificationsAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const result = await ReservationNotificationService.processNotifications();
    return createActionResponse(result);
  } catch (error) {
    console.error("Error en processReservationNotificationsAction:", error);
    return handleActionError(error);
  }
}
