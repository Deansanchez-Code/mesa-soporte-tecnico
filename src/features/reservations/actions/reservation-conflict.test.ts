import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReservationAction } from "./reservationActions";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Prueba de Solapamiento", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockSupabase: any = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient as any).mockResolvedValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "123e4567-e89b-12d3-a456-426614174000" } },
    });
  });

  it("debe bloquear reserva si detecta conflicto con PENDING", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };

      if (table === "users") {
        chain.single.mockResolvedValue({
          data: { id: "123e4567-e89b-12d3-a456-426614174000", role: "user" },
        });
      } else if (table === "system_settings") {
        chain.maybeSingle.mockResolvedValue({
          data: { value: { is_active: false } },
        });
      } else if (table === "reservations") {
        // Simulamos que encuentra 1 registro (conflicto)
        // La cadena termina en gt() para el conflict check
        chain.gt.mockResolvedValue({ data: [{ id: 999 }], error: null });
      }
      return chain;
    });

    const result = await createReservationAction({
      title: "Test",
      start_time: "2026-11-20T10:00:00-05:00",
      end_time: "2026-11-20T12:00:00-05:00",
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      auditorium_id: "1",
    });

    console.log("RESULTADO TEST 1:", result);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Horario no disponible");
  });

  it("debe bloquear reserva si la fecha u horario se encuentra en el pasado", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };

      if (table === "users") {
        chain.single.mockResolvedValue({
          data: {
            id: "123e4567-e89b-12d3-a456-426614174000",
            role: "instructor",
          },
        });
      }
      return chain;
    });

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await createReservationAction({
      title: "Reserva Pasada",
      start_time: pastDate,
      end_time: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      auditorium_id: "1",
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("fechas u horarios del pasado");
  });

  it("debe bloquear reserva si detecta conflicto en Ambiente 107 (auditorium_id 4)", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };

      if (table === "users") {
        chain.single.mockResolvedValue({
          data: {
            id: "123e4567-e89b-12d3-a456-426614174000",
            role: "instructor",
            job_category: "instructor",
          },
        });
      } else if (table === "system_settings") {
        chain.maybeSingle.mockResolvedValue({
          data: { value: { is_active: false } },
        });
      } else if (table === "reservations") {
        chain.gt.mockResolvedValue({ data: [{ id: 888 }], error: null });
      }
      return chain;
    });

    const result = await createReservationAction({
      title: "Clase Programación",
      start_time: "2026-11-10T08:00:00-05:00",
      end_time: "2026-11-10T12:00:00-05:00",
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      auditorium_id: "4",
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Horario no disponible");
  });
});
