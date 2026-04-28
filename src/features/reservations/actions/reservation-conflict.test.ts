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
      data: { user: { id: "u1" } },
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
      };

      if (table === "users") {
        chain.single.mockResolvedValue({ data: { id: "u1", role: "user" } });
      } else if (table === "reservations") {
        // Simulamos que encuentra 1 registro (conflicto)
        // La cadena termina en gt() para el conflict check
        chain.gt.mockResolvedValue({ data: [{ id: 999 }], error: null });
      }
      return chain;
    });

    const result = await createReservationAction({
      title: "Test",
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      user_id: "u1",
      auditorium_id: "1",
    });

    console.log("RESULTADO TEST 1:", result);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Horario no disponible");
  });
});
