"use server";

import { createClient } from "@/lib/supabase/servidor";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  TicketService,
  TicketSchema,
  CreateTicketInput,
} from "../services/ticket.service";
import {
  handleActionError,
  createActionResponse,
} from "@/lib/server-action-utils";
import { getSLAHours, calculateSLADueDate } from "@/lib/domain/sla-calculator";
import { Ticket } from "@/app/admin/admin.types";
import Logger from "@/lib/logger";

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
    await Logger.error("Error creating ticket", { error });
    return handleActionError(error);
  }
}
export async function createTicketsBatchAction(
  ticketsData: z.infer<typeof TicketSchema>[],
) {
  try {
    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    // 1.1 Get Public User Profile
    const { data: publicUser } = await supabase
      .from("users")
      .select("id, is_vip")
      .eq("auth_id", authUser.id)
      .single();

    const isVip = !!publicUser?.is_vip;
    const createdAt = new Date().toISOString();

    // 2. Prepare Batch
    const ticketsToInsert = ticketsData.map((data) => {
      const parseResult = TicketSchema.safeParse(data);
      if (!parseResult.success) {
        throw new Error("Datos de ticket inválidos en lote");
      }

      const {
        category,
        ticket_type,
        asset_serial,
        location,
        description,
        event_date,
      } = parseResult.data;

      // Determine Status/SLA (Logic 24h)
      let initialStatus = "PENDIENTE";
      let slaStatus: "running" | "paused" = "running";

      if (
        event_date &&
        (category.toLowerCase().includes("auditorio") ||
          category.toLowerCase().includes("reserva"))
      ) {
        const now = new Date();
        const eventStart = new Date(event_date);
        const hoursDiff =
          (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
          initialStatus = "EN_ESPERA";
          slaStatus = "paused";
        }
      }

      const slaHours = getSLAHours({
        is_vip_ticket: isVip,
        ticket_type: ticket_type,
      } as Ticket);
      const expectedEndAt = calculateSLADueDate(createdAt, slaHours);

      return {
        category,
        ticket_type,
        asset_serial,
        location,
        description,
        user_id: data.user_id || authUser.id,
        status: initialStatus,
        is_vip_ticket: isVip,
        sla_start_at: createdAt,
        sla_expected_end_at: expectedEndAt.toISOString(),
        sla_status: slaStatus,
      };
    });

    // 3. Batch Insert
    const { data: result, error } = await supabase
      .from("tickets")
      .insert(ticketsToInsert)
      .select();

    if (error) throw error;

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("Batch Ticket Creation Error:", error);
    await Logger.error("Batch Ticket Creation Error", { error });
    const errorMsg =
      (error as Record<string, unknown>)?.message || String(error);
    return { error: errorMsg };
  }
}

export async function resolveTicketAction(ticketId: number, solution: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    const result = await TicketService.resolveTicket(
      ticketId,
      solution,
      user.id,
    );

    revalidatePath("/dashboard");
    return createActionResponse(result);
  } catch (error: unknown) {
    await Logger.error("Error resolving ticket", { error, ticketId });
    return handleActionError(error);
  }
}
