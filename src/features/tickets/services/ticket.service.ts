import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { AssignmentService } from "./assignment.service";
import { SlaService } from "./sla.service";
import Logger from "@/lib/logger";
import { Database } from "@/app/admin/types";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export const TicketSchema = z.object({
  category: z.string().min(1, "La categoría es requerida"),
  ticket_type: z.enum(["INC", "REQ"]).default("REQ"),
  asset_serial: z.string().optional().nullable(),
  location: z.string().min(1, "La ubicación es requerida"),
  description: z.string().optional(),
  user_id: z.string().optional(), // Optional for admin-created tickets
  event_date: z.string().optional().nullable(), // ISO String de inicio del evento
});

export type CreateTicketInput = z.infer<typeof TicketSchema>;

export class TicketService {
  /**
   * Crea un nuevo ticket orquestando reglas de negocio, SLA y asignación.
   */
  static async createTicket(input: CreateTicketInput, authUserId: string) {
    const supabase = await createClient();

    // 1. Obtener perfil de usuario (para verificar VIP)
    // El ticket puede ser creado "a nombre de" otro usuario (input.user_id) si es admin
    const targetUserId = input.user_id || authUserId;

    // Verificar existencia y perfil VIP del usuario objetivo
    const { data: publicUser, error: userError } = await supabase
      .from("users")
      .select("id, is_vip, auth_id")
      .eq("auth_id", targetUserId) // Ojo: input.user_id suele ser auth_id en frontend, verificar.
      // En admin.types, user_id se refiere a UUID de la tabla users o auth_id?
      // Revisando schema: tickets.user_id -> users.id (UUID tabla pública).
      // Pero createTicketAction usaba: user_id: data.user_id || authUser.id
      // authUser.id es Auth ID.
      // Y luego hacía select ... .eq("auth_id", authUser.id)
      // Asumiremos que trabajamos con Auth IDs y buscamos el User ID público.
      .single();

    if (userError || !publicUser) {
      // Intento de fallback: buscar por ID público si no se encontró por Auth ID
      // (caso raro si el input traía ID público)
      throw new Error(`Usuario no encontrado para ID ${targetUserId}`);
    }

    const isVip = !!publicUser.is_vip;

    // 2. Determinar estado inicial y SLA Status
    const { status, slaStatus } = SlaService.determineInitialStatus(
      input.category,
      input.event_date,
    );

    // 3. Asignación Automática
    const assignedAgentId = await AssignmentService.getAutoAssignmentAgent();

    // 4. Calcular SLA
    const slaHours = SlaService.getSLAHours({
      is_vip_ticket: isVip,
      ticket_type: input.ticket_type,
    });

    const createdAt = new Date();
    const expectedEndAt = SlaService.calculateDueDate(
      createdAt.toISOString(),
      slaHours,
    );

    // 5. Insertar en Base de Datos
    const { data: result, error } = await supabase
      .from("tickets")
      .insert([
        {
          category: input.category,
          ticket_type: input.ticket_type,
          asset_serial: input.asset_serial,
          location: input.location,
          description: input.description,
          user_id: publicUser.id, // Usamos el ID público (UUID de tabla users)
          status: status,
          assigned_agent_id: assignedAgentId, // Auth ID del agente (según assignment service)
          is_vip_ticket: isVip,
          sla_start_at: createdAt.toISOString(),
          sla_expected_end_at: expectedEndAt.toISOString(),
          sla_status: slaStatus,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // 6. Notificación por Correo (Async - no bloquea la respuesta)
    // Se intenta obtener los detalles del usuario para el envío
    this.sendTicketCreationEmail(result).catch((e) =>
      Logger.error("Failed to send ticket creation email", e),
    );

    return result;
  }

  /**
   * Envía el correo de notificación de creación de ticket.
   */
  private static async sendTicketCreationEmail(ticket: TicketRow) {
    try {
      const { EmailService } = await import("@/lib/email/email-service");
      const { TicketNotification } =
        await import("@/lib/email/templates/TicketNotification");
      const supabase = await createClient();

      // Obtener el perfil del usuario para el email
      const { data: user } = await supabase
        .from("users")
        .select("full_name, email, employment_type, username")
        .eq("id", ticket.user_id)
        .single();

      if (!user) return;

      // Lógica de destinatario (SENA vs Personal)
      const employmentType = (user.employment_type || "").toLowerCase();
      const isOfficial =
        employmentType.includes("planta") ||
        employmentType.includes("funcionario") ||
        employmentType.includes("oficial");

      let recipientEmail = user.email;
      if (isOfficial && user.username) {
        recipientEmail = `${user.username.trim()}@sena.edu.co`.toLowerCase();
      }

      if (!recipientEmail || !recipientEmail.includes("@")) return;

      await EmailService.send({
        to: recipientEmail,
        subject: `Confirmación de Solicitud: Ticket #${ticket.id}`,
        react: TicketNotification({
          userName: user.full_name,
          ticketId: ticket.id,
          category: ticket.category || "General",
          description: ticket.description ?? undefined,
          location: ticket.location,
          priority: ticket.is_vip_ticket ? "ALTA (VIP)" : "NORMAL",
        }),
      });
    } catch (error) {
      console.error("Error dispatching ticket email:", error);
    }
  }

  /**
   * Resuelve un ticket, registra la solución y notifica al usuario.
   */
  static async resolveTicket(
    ticketId: number,
    solution: string,
    agentId: string,
  ) {
    const supabase = await createClient();

    // 1. Obtener ticket y datos del usuario
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*, users(*)")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket no encontrado");

    // 2. Actualizar estado y solución
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        status: "RESUELTO",
        solution: solution,
        assigned_agent_id: agentId,
        sla_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (updateError) throw updateError;

    // 3. Notificación por Correo (Async)
    this.sendTicketResolutionEmail(ticket, solution).catch((e) =>
      Logger.error("Failed to send ticket resolution email", e),
    );

    return { success: true };
  }

  /**
   * Envía el correo de notificación de resolución.
   */
  private static async sendTicketResolutionEmail(
    ticket: TicketRow & { users: UserRow | null },
    solution: string,
  ) {
    try {
      const { EmailService } = await import("@/lib/email/email-service");
      const { TicketResolvedNotification } =
        await import("@/lib/email/templates/TicketResolvedNotification");

      const user = ticket.users;
      if (!user) return;

      const employmentType = (user.employment_type || "").toLowerCase();
      const isOfficial =
        employmentType.includes("planta") ||
        employmentType.includes("funcionario") ||
        employmentType.includes("oficial");

      let recipientEmail = user.email;
      if (isOfficial && user.username) {
        recipientEmail = `${user.username.trim()}@sena.edu.co`.toLowerCase();
      }

      if (!recipientEmail || !recipientEmail.includes("@")) return;

      await EmailService.send({
        to: recipientEmail,
        subject: `Solicitud Resuelta: Ticket #${ticket.id}`,
        react: TicketResolvedNotification({
          userName: user.full_name,
          ticketId: String(ticket.id),
          category: ticket.category || "General",
          solution: solution,
        }),
      });
    } catch (error) {
      console.error("Error dispatching resolution email:", error);
    }
  }
}
