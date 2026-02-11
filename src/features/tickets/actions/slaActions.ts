"use server";

import { revalidatePath } from "next/cache";
import {
  handleActionError,
  createActionResponse,
} from "@/lib/server-action-utils";
import { SlaService } from "../services/sla.service";

/**
 * Revisa los tickets en estado EN_ESPERA (auditorios futuros)
 * y los activa si faltan menos de 24h para el evento.
 */
export async function checkAndActivateTicketsAction() {
  try {
    const activatedCount = await SlaService.activatePendingTickets();

    if (activatedCount > 0) {
      revalidatePath("/dashboard");
    }

    return createActionResponse({ activatedCount });
  } catch (error) {
    return handleActionError(error);
  }
}
