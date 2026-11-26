import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTicketForApprovedReservation,
  AdminSupabaseClient,
} from "./reservationTicketService";

interface MockTicketRow {
  id: number;
  description: string | null;
}

function createMockSupabase(existingTickets: MockTicketRow[] = []) {
  const insertedPayloads: Record<string, unknown>[][] = [];

  const mockClient = {
    from: vi.fn((table: string) => {
      if (table !== "tickets") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: existingTickets,
            error: null,
          }),
        })),
        insert: vi.fn((rows: Record<string, unknown>[]) => {
          insertedPayloads.push(rows);
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 901 },
                error: null,
              }),
            })),
          };
        }),
      };
    }),
  };

  return {
    client: mockClient as unknown as AdminSupabaseClient,
    insertedPayloads,
  };
}

describe("reservationTicketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea ticket EN_ESPERA con SLA paused para Ambiente 107 cuando inicia en > 24h", async () => {
    const { client, insertedPayloads } = createMockSupabase();
    const startMs = Date.now() + 72 * 60 * 60 * 1000;
    const endMs = startMs + 2 * 60 * 60 * 1000;
    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(endMs).toISOString();

    const expectedDateStr = new Date(startIso)
      .toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
      .split("-")
      .reverse()
      .join("-");

    const res = await createTicketForApprovedReservation(
      client,
      {
        id: 10,
        title: "Taller Robótica 107",
        start_time: startIso,
        end_time: endIso,
        user_id: "user-uuid-1",
        auditorium_id: "4",
        resources: ["Proyector", "Sonido"],
        description: "Mesas en U",
        users: { is_vip: false, job_category: "instructor" },
      },
      "Nury Mildret Barrera",
    );

    expect(res).toEqual({ created: true, skipped: false, ticketId: 901 });
    expect(insertedPayloads).toHaveLength(1);
    const payload = insertedPayloads[0][0];
    expect(payload.category).toBe("Reserva Auditorio");
    expect(payload.ticket_type).toBe("REQ");
    expect(payload.location).toBe("Ambiente 107");
    expect(payload.status).toBe("EN_ESPERA");
    expect(payload.sla_status).toBe("paused");
    expect(payload.sla_expected_end_at).toBe(startIso);
    expect(payload.description).toContain(`Fechas: ${expectedDateStr}`);
    expect(payload.description).toMatch(
      /Hora:\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/,
    );
    expect(payload.description).toContain(
      "AUTORIZADA POR Nury Mildret Barrera",
    );
  });

  it("crea ticket PENDIENTE con SLA running para Ambiente 107 cuando inicia en <= 24h", async () => {
    const { client, insertedPayloads } = createMockSupabase();
    const startMs = Date.now() + 2 * 60 * 60 * 1000;
    const endMs = startMs + 2 * 60 * 60 * 1000;

    const res = await createTicketForApprovedReservation(
      client,
      {
        id: 11,
        title: "Sesión Urgente 107",
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        user_id: "user-uuid-2",
        auditorium_id: "4",
        resources: [],
        description: null,
        users: { is_vip: true, job_category: "coordinador" },
      },
      "Nury Mildret Barrera",
    );

    expect(res).toEqual({ created: true, skipped: false, ticketId: 901 });
    expect(insertedPayloads).toHaveLength(1);
    const payload = insertedPayloads[0][0];
    expect(payload.location).toBe("Ambiente 107");
    expect(payload.status).toBe("PENDIENTE");
    expect(payload.sla_status).toBe("running");
    expect(payload.is_vip_ticket).toBe(true);
  });

  it("evita duplicar si ya existe un ticket activo con el mismo título y fecha", async () => {
    const startIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const endIso = new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString();
    const existingDateStr = new Date(startIso)
      .toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
      .split("-")
      .reverse()
      .join("-");

    const { client, insertedPayloads } = createMockSupabase([
      {
        id: 555,
        description: `Reserva de Ambiente 107: Evento Repetido\nFechas: ${existingDateStr}\nHora: 10:00 - 12:00`,
      },
    ]);

    const res = await createTicketForApprovedReservation(
      client,
      {
        id: 12,
        title: "Evento Repetido",
        start_time: startIso,
        end_time: endIso,
        user_id: "user-uuid-3",
        auditorium_id: "4",
        resources: [],
        description: null,
        users: { is_vip: false, job_category: "instructor" },
      },
      "Nury Mildret Barrera",
    );

    expect(res).toEqual({ created: false, skipped: true, ticketId: 555 });
    expect(insertedPayloads).toHaveLength(0);
  });
});
