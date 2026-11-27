import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssignableUsersAction } from "./assignmentAdminActions";
import { resolveAuthenticatedPublicUser } from "../services/reservationAuthServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../services/reservationAuthServer", () => ({
  resolveAuthenticatedPublicUser: vi.fn(),
}));

const mockedResolveCaller = vi.mocked(resolveAuthenticatedPublicUser);
const mockedGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

describe("Control de acceso en getAssignableUsersAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza la consulta a usuarios autenticados sin privilegios activos en BD (ej. egutierrezn revocada)", async () => {
    mockedResolveCaller.mockResolvedValue({
      id: "user-revoked-1",
      full_name: "Emilce Gutierrez",
      role: "user",
      username: "egutierrezn",
      job_category: "funcionario",
      is_vip: false,
      perm_manage_assignments: false,
      is_active: true,
    });

    const result = await getAssignableUsersAction("token-revocado");

    expect(result).toEqual({ success: false, users: [] });
    expect(mockedGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("retorna la lista de funcionarios asignables cuando el llamador tiene privilegios vigentes en BD", async () => {
    mockedResolveCaller.mockResolvedValue({
      id: "user-coord-1",
      full_name: "Coordinador Vigente",
      role: "user",
      username: "coord.vigente",
      job_category: "coordinador",
      is_vip: true,
      perm_manage_assignments: true,
      is_active: true,
    });

    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "inst-1",
          full_name: "Instructor Uno",
          username: "inst1",
          email: "inst1@sena.edu.co",
          role: "user",
          job_category: "instructor",
          employment_type: "planta",
          area: "Sistemas",
          is_vip: false,
        },
      ],
      error: null,
    });
    const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    mockedGetSupabaseAdmin.mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const result = await getAssignableUsersAction("token-valido");

    expect(result.success).toBe(true);
    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.username).toBe("inst1");
  });
});
