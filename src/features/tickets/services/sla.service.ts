import { Ticket } from "@/app/admin/admin.types";
import { calculateSLADueDate, getSLAHours } from "@/lib/domain/sla-calculator";
import { createClient } from "@/lib/supabase/servidor";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/app/admin/types";

export class SlaService {
  /**
   * Revisa y activa tickets EN_ESPERA que estén dentro de las 24h del evento.
   * Retorna el número de tickets activados.
   */
  static async activatePendingTickets(): Promise<number> {
    // 0. Validar horario (7:00 - 21:00 COT / UTC-5)
    const now = new Date();
    // Convertir a hora de Colombia (UTC-5)
    // Usando una forma simple: restar 5 horas al UTC
    const colombiaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const hour = colombiaTime.getUTCHours();

    if (hour < 7 || hour >= 21) {
      console.log(
        `Cron omitido: Hora actual ${hour}:00 COT fuera del rango 07:00-21:00`,
      );
      return 0;
    }

    const supabase = await createClient();

    // 1. Buscar tickets EN_ESPERA
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select("id, description, status, sla_status")
      .eq("status", "EN_ESPERA");

    if (error) throw error;
    if (!tickets || tickets.length === 0) {
      await this.logExecution(supabase, 0);
      return 0;
    }

    const ticketsToActivate: number[] = [];

    // 2. Filtrar cuáles deben activarse
    for (const t of tickets) {
      const desc = t.description || "";
      const dateMatch = desc.match(/Fecha: (\d{2}-\d{2}-\d{4})/);
      const timeMatch = desc.match(/Hora: (\d{2}:\d{2})/);

      if (dateMatch && timeMatch) {
        const [d, m, y] = dateMatch[1].split("-");
        const eventDate = new Date(`${y}-${m}-${d}T${timeMatch[1]}`);

        const hoursDiff =
          (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          ticketsToActivate.push(t.id);
        }
      }
    }

    // 3. Actualizar en lote
    if (ticketsToActivate.length > 0) {
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "PENDIENTE",
          sla_status: "running",
          sla_start_at: new Date().toISOString(),
        })
        .in("id", ticketsToActivate);

      if (updateError) throw updateError;
    }

    // 4. Registrar ejecución en auditoría
    await this.logExecution(supabase, ticketsToActivate.length);

    return ticketsToActivate.length;
  }

  /**
   * Registra la ejecución en la tabla de auditoría para historial y UI.
   */
  private static async logExecution(
    supabase: SupabaseClient<Database>,
    count: number,
  ) {
    await supabase.from("audit_logs").insert([
      {
        action: "CRON_SLA_CHECK",
        resource: "SLA_SYSTEM",
        details: {
          activated_count: count,
          executed_at: new Date().toISOString(),
        },
      },
    ]);
  }
  /**
   * Determina las horas de SLA configuradas para un ticket.
   */
  static getSLAHours(
    ticket: Partial<Ticket> & {
      ticket_type: "INC" | "REQ";
      is_vip_ticket: boolean;
    },
  ): number {
    return getSLAHours(ticket as Ticket);
  }

  /**
   * Calcula la fecha de vencimiento del SLA.
   */
  static calculateDueDate(startDate: string, hours: number): Date {
    return calculateSLADueDate(startDate, hours);
  }

  /**
   * Determina el estado inicial de un ticket basado en su categoría y fecha de evento.
   * Regla de negocio: Si es una reserva de auditorio con > 24h de anticipación,
   * el ticket nace en estado EN_ESPERA y SLA pausado.
   */
  static determineInitialStatus(
    category: string,
    eventDate?: string | null,
  ): { status: string; slaStatus: "running" | "paused" } {
    let initialStatus = "PENDIENTE";
    let slaStatus: "running" | "paused" = "running";

    if (
      eventDate &&
      (category.toLowerCase().includes("auditorio") ||
        category.toLowerCase().includes("reserva"))
    ) {
      const now = new Date();
      const eventStart = new Date(eventDate);
      const hoursDiff =
        (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Si falta más de 24h para el evento, se pausa.
      if (hoursDiff > 24) {
        initialStatus = "EN_ESPERA";
        slaStatus = "paused";
      }
    }

    return { status: initialStatus, slaStatus };
  }
}
