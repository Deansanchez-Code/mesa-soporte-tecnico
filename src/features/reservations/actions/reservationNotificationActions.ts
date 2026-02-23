"use server";

import { ReservationNotificationService } from "../services/reservationNotificationService";
import {
  handleActionError,
  createActionResponse,
} from "@/lib/server-action-utils";

/**
 * Acción de servidor para procesar notificaciones de reserva.
 * Puede ser llamada desde el disparador silencioso en el frontend.
 */
export async function processReservationNotificationsAction() {
  try {
    const result = await ReservationNotificationService.processNotifications();
    return createActionResponse(result);
  } catch (error) {
    console.error("Error en processReservationNotificationsAction:", error);
    return handleActionError(error);
  }
}
