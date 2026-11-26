import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, PUT, DELETE, PATCH } from "./route";

const {
  mockVerifyPermissions,
  mockCreateUser,
  mockUpdateUserById,
  mockUsersSelectOrMaybeSingle,
  mockUsersSelectAll,
  mockUsersUpdateIn,
} = vi.hoisted(() => ({
  mockVerifyPermissions: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUserById: vi.fn(),
  mockUsersSelectOrMaybeSingle: vi.fn(),
  mockUsersSelectAll: vi.fn(),
  mockUsersUpdateIn: vi.fn(),
}));

vi.mock("@/lib/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        ctx: { user: { id: string } },
      ) => Promise<Response>,
    ) =>
    (req: NextRequest) =>
      handler(req, { user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));

vi.mock("@/lib/auth-check", () => ({
  verifyUserPermissions: mockVerifyPermissions,
  forbidden: (msg?: string) =>
    new Response(JSON.stringify({ error: msg || "Forbidden" }), {
      status: 403,
    }),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: (cols?: string) => {
        if (cols?.includes("is_active")) {
          return mockUsersSelectAll();
        }
        return {
          or: () => ({
            maybeSingle: mockUsersSelectOrMaybeSingle,
          }),
        };
      },
      update: () => ({
        or: vi.fn().mockResolvedValue({ error: null }),
        in: mockUsersUpdateIn,
      }),
    }),
    auth: {
      admin: {
        createUser: mockCreateUser,
        updateUserById: mockUpdateUserById,
      },
    },
  }),
}));

describe("Admin Users RBAC y Vigencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersUpdateIn.mockResolvedValue({ error: null });
    mockUpdateUserById.mockResolvedValue({ error: null });
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
      error: null,
    });
  });

  it("bloquea con 403 cuando un admin intenta crear un soporte técnico (agent)", async () => {
    mockVerifyPermissions.mockImplementation(
      async (_userId: string, allowed: string[]) => allowed.includes("admin"),
    );

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "soporte@sena.edu.co",
        password: "PasswordSegura123",
        full_name: "Nuevo Soporte",
        role: "agent",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("permite a superadmin crear un soporte técnico (agent)", async () => {
    mockVerifyPermissions.mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "soporte@sena.edu.co",
        password: "PasswordSegura123",
        full_name: "Nuevo Soporte",
        role: "agent",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
  });

  it("bloquea con 403 cuando un admin intenta editar o habilitar un soporte existente", async () => {
    mockVerifyPermissions.mockImplementation(
      async (_userId: string, allowed: string[]) => allowed.includes("admin"),
    );
    mockUsersSelectOrMaybeSingle.mockResolvedValue({
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        role: "agent",
      },
    });

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "PUT",
      body: JSON.stringify({
        id: "33333333-3333-4333-8333-333333333333",
        is_active: true,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("bloquea con 403 cuando un admin intenta desactivar un soporte (DELETE)", async () => {
    mockVerifyPermissions.mockImplementation(
      async (_userId: string, allowed: string[]) => allowed.includes("admin"),
    );
    mockUsersSelectOrMaybeSingle.mockResolvedValue({
      data: { role: "agent" },
    });

    const req = new NextRequest(
      "http://localhost/api/admin/users?id=33333333-3333-4333-8333-333333333333",
      { method: "DELETE" },
    );

    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("bloquea con 403 cuando un admin intenta ejecutar cambio de vigencia anual", async () => {
    mockVerifyPermissions.mockImplementation(
      async (_userId: string, allowed: string[]) => allowed.includes("admin"),
    );

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ action: "rollover_vigencia" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(403);
    expect(mockUsersUpdateIn).not.toHaveBeenCalled();
  });

  it("ejecuta rollover_vigencia cuando lo invoca superadmin desactivando solo contratistas y soportes", async () => {
    mockVerifyPermissions.mockResolvedValue(true);
    mockUsersSelectAll.mockResolvedValue({
      data: [
        {
          id: "u-contra",
          auth_id: "u-contra",
          role: "contractor",
          employment_type: "contratista",
          is_vip: false,
          is_active: true,
        },
        {
          id: "u-agent",
          auth_id: "u-agent",
          role: "agent",
          employment_type: "contratista",
          is_vip: false,
          is_active: true,
        },
        {
          id: "u-planta",
          auth_id: "u-planta",
          role: "user",
          employment_type: "planta",
          is_vip: false,
          is_active: true,
        },
        {
          id: "u-vip",
          auth_id: "u-vip",
          role: "vip",
          employment_type: "contratista",
          is_vip: true,
          is_active: true,
        },
        {
          id: "u-super",
          auth_id: "u-super",
          role: "superadmin",
          employment_type: "planta",
          is_vip: true,
          is_active: true,
        },
      ],
      error: null,
    });

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ action: "rollover_vigencia" }),
    });

    const res = await PATCH(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.affectedContractors).toBe(1);
    expect(json.affectedSupports).toBe(1);
    expect(mockUsersUpdateIn).toHaveBeenCalledWith("id", [
      "u-contra",
      "u-agent",
    ]);
  });
});
