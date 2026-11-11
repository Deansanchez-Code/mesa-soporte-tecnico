"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const activatedCount = await SlaService.activatePendingTickets();

    if (activatedCount > 0) {
      revalidatePath("/dashboard");
    }

    return createActionResponse({ activatedCount });
  } catch (error) {
    return handleActionError(error);
  }
}
