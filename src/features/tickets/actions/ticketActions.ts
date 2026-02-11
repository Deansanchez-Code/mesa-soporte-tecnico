"use server";

import { createClient } from "@/lib/supabase/servidor";
import { revalidatePath } from "next/cache";
import {
  TicketService,
  TicketSchema,
  CreateTicketInput,
} from "../services/ticket.service";
import {
  handleActionError,
  createActionResponse,
} from "@/lib/server-action-utils";

export async function createTicketAction(data: CreateTicketInput) {
  try {
    const parseResult = TicketSchema.safeParse(data);
    if (!parseResult.success) {
      throw parseResult.error; // Esto será manejado por handleActionError (ZodError)
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    const newTicket = await TicketService.createTicket(
      parseResult.data,
      user.id,
    );

    revalidatePath("/dashboard");
    return createActionResponse(newTicket);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
