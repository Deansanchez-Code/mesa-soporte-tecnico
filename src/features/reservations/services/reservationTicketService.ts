import type { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Ticket } from "@/app/admin/admin.types";
import { getSLAHours, calculateSLADueDate } from "@/lib/domain/sla-calculator";

export type AdminSupabaseClient = ReturnType<typeof getSupabaseAdmin>;

export interface ApprovedReservationTicketInput {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  user_id: string;
  auditorium_id: string | number;
  resources?: string[] | null;
  description?: string | null;
  users?: {
    is_vip?: boolean | null;
    job_category?: string | null;
  } | null;
}

export interface CreateReservationTicketResult {
  created: boolean;
  skipped: boolean;
  ticketId: number | null;
}

function resolveSpaceLabel(auditoriumId: string | number): string {
  const sid = String(auditoriumId);
  if (sid === "3") return "Biblioteca";
  if (sid === "4") return "Ambiente 107";
  if (sid === "5") return "Ambiente de Cocina";
  if (sid === "2") return "Subdirección";
  return "Auditorio 103";
}

function formatBogotaDateDDMMYYYY(isoDate: string): string {
  return new Date(isoDate)
    .toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
    .split("-")
    .reverse()
    .join("-");
}

function formatBogotaTime24h(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Bogota",
  });
}

/**
 * Crea un ticket consolidado en la mesa de ayuda únicamente cuando una reserva
 * ya ha sido autorizada (APPROVED), aplicando control de idempotencia y reglas SLA.
 */
export async function createTicketForApprovedReservation(
  supabaseAdmin: AdminSupabaseClient,
  reservation: ApprovedReservationTicketInput,
  coordinatorName: string,
): Promise<CreateReservationTicketResult> {
  const spaceLabel = resolveSpaceLabel(reservation.auditorium_id);
  const dateStr = formatBogotaDateDDMMYYYY(reservation.start_time);
  const startTimeStr = formatBogotaTime24h(reservation.start_time);
  const endTimeStr = formatBogotaTime24h(reservation.end_time);

  // Guardia de idempotencia: evita duplicar si ya existe un ticket activo para el mismo evento y fecha
  const { data: existingTickets, error: lookupError } = await supabaseAdmin
    .from("tickets")
    .select("id, description")
    .eq("user_id", reservation.user_id)
    .eq("category", "Reserva Auditorio")
    .eq("location", spaceLabel)
    .ilike("description", `%${reservation.title}%`)
    .not("status", "in", '("CANCELADO","CERRADO","RESUELTO")');

  if (lookupError) {
    throw lookupError;
  }

  const duplicate = (existingTickets || []).find(
    (t) => typeof t.description === "string" && t.description.includes(dateStr),
  );
  if (duplicate) {
    return { created: false, skipped: true, ticketId: duplicate.id };
  }

  const isVip =
    Boolean(reservation.users?.is_vip) ||
    (reservation.users?.job_category || "").toLowerCase() === "coordinador";

  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const eventStart = new Date(reservation.start_time);
  const hoursDiff = (eventStart.getTime() - nowMs) / (1000 * 60 * 60);

  let initialStatus = "PENDIENTE";
  let slaStatus: "running" | "paused" = "running";
  let expectedEndAt: Date;

  if (hoursDiff > 24) {
    initialStatus = "EN_ESPERA";
    slaStatus = "paused";
    expectedEndAt = eventStart;
  } else {
    const slaHours = getSLAHours({
      is_vip_ticket: isVip,
      ticket_type: "REQ",
    } as Ticket);
    expectedEndAt = calculateSLADueDate(createdAt, slaHours);
  }

  const resourcesStr = (reservation.resources || []).join(", ");
  const description = `Reserva de ${spaceLabel}: ${reservation.title}\nFechas: ${dateStr}\nHora: ${startTimeStr} - ${endTimeStr}\nRecursos: ${resourcesStr}\nDetalles: ${reservation.description || ""}\n(AUTORIZADA POR ${coordinatorName})`;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("tickets")
    .insert([
      {
        category: "Reserva Auditorio",
        ticket_type: "REQ",
        location: spaceLabel,
        description,
        user_id: reservation.user_id,
        status: initialStatus,
        is_vip_ticket: isVip,
        sla_start_at: createdAt,
        sla_expected_end_at: expectedEndAt.toISOString(),
        sla_status: slaStatus,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    created: true,
    skipped: false,
    ticketId: inserted?.id ?? null,
  };
}

/**
 * Cancela de forma suave (sin borrado físico) los tickets legados activos
 * vinculados a una reserva rechazada/cancelada por el coordinador.
 */
export async function cancelTicketForReservation(
  supabaseAdmin: AdminSupabaseClient,
  reservation: {
    user_id: string;
    title: string;
    auditorium_id?: string | number;
    start_time?: string;
  },
  reasonNote: string,
  actorId?: string | null,
): Promise<number> {
  let query = supabaseAdmin
    .from("tickets")
    .select("id, status, description")
    .eq("user_id", reservation.user_id)
    .eq("category", "Reserva Auditorio")
    .ilike("description", `%${reservation.title}%`)
    .not("status", "in", '("CANCELADO","CERRADO","RESUELTO")')
    .order("created_at", { ascending: false });

  if (reservation.auditorium_id !== undefined) {
    query = query.eq("location", resolveSpaceLabel(reservation.auditorium_id));
  }

  const { data: tickets, error: fetchError } = await query;
  if (fetchError) throw fetchError;
  if (!tickets || tickets.length === 0) return 0;

  const targetDateStr = reservation.start_time
    ? formatBogotaDateDDMMYYYY(reservation.start_time)
    : null;

  const matching = targetDateStr
    ? tickets.filter(
        (t) =>
          typeof t.description === "string" &&
          t.description.includes(targetDateStr),
      )
    : tickets;

  const toCancel = matching.length > 0 ? matching : tickets;
  let cancelledCount = 0;

  for (const ticket of toCancel) {
    const { error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        status: "CANCELADO",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (updateError) continue;

    await supabaseAdmin.from("ticket_events").insert({
      ticket_id: ticket.id,
      actor_id: actorId ?? null,
      action_type: "STATUS_CHANGE",
      old_value: ticket.status || "PENDIENTE",
      new_value: "CANCELADO",
      comment: `CANCELACIÓN AUTOMÁTICA: ${reasonNote}.`,
    });

    cancelledCount++;
  }

  return cancelledCount;
}
