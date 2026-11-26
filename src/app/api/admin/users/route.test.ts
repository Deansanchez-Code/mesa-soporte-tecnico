import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, PUT, DELETE, PATCH } from "./route";

const {
  mockVerifyPermissions,
  mockCreateUser,
  mockGetUserById,
  mockUpdateUserById,
  mockUsersSelectOrMaybeSingle,
  mockUsersSelectAll,
  mockUsersUpdate,
  mockUsersUpdateIn,
} = vi.hoisted(() => ({
  mockVerifyPermissions: vi.fn(),
  mockCreateUser: vi.fn(),
  mockGetUserById: vi.fn(),
  mockUpdateUserById: vi.fn(),
  mockUsersSelectOrMaybeSingle: vi.fn(),
  mockUsersSelectAll: vi.fn(),
  mockUsersUpdate: vi.fn(),
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
      update: (payload: Record<string, unknown>) => {
        mockUsersUpdate(payload);
        return {
          or: vi.fn().mockResolvedValue({ error: null }),
          in: mockUsersUpdateIn,
        };
      },
    }),
    auth: {
      admin: {
        createUser: mockCreateUser,
        getUserById: mockGetUserById,
        updateUserById: mockUpdateUserById,
      },
    },
  }),
}));

describe("Admin Users RBAC y Vigencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersUpdateIn.mockResolvedValue({ error: null });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: "auth-target-1", app_metadata: {} } },
    });
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

  it("limpia privilegios residuales de coordinación y revoca PIN al quitar is_vip a un ex-coordinador", async () => {
    mockVerifyPermissions.mockResolvedValue(true);
    mockUsersSelectOrMaybeSingle.mockResolvedValue({
      data: {
        id: "44444444-4444-4444-8444-444444444444",
        auth_id: "55555555-5555-4555-8555-555555555555",
        username: "excoordplanta",
        role: "coordinator",
        job_category: "coordinador",
        is_vip: true,
        perm_manage_assignments: true,
      },
    });
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: "55555555-5555-4555-8555-555555555555",
          app_metadata: { kiosk_pin_hash: "scrypt:abc:def" },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "PUT",
      body: JSON.stringify({
        id: "44444444-4444-4444-8444-444444444444",
        is_vip: false,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_vip: false,
        job_category: "funcionario",
        perm_manage_assignments: false,
        role: "user",
      }),
    );
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "55555555-5555-4555-8555-555555555555",
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          kiosk_pin_hash: null,
          kiosk_pin_revoked_pending_notice: true,
        }),
      }),
    );
  });

  it("limpia is_vip, perm_manage_assignments y revoca PIN al degradar cargo de coordinador a funcionario", async () => {
    mockVerifyPermissions.mockResolvedValue(true);
    mockUsersSelectOrMaybeSingle.mockResolvedValue({
      data: {
        id: "66666666-6666-4666-8666-666666666666",
        auth_id: "77777777-7777-4777-8777-777777777777",
        username: "excoordcargo",
        role: "coordinator",
        job_category: "coordinador",
        is_vip: true,
        perm_manage_assignments: true,
      },
    });
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: "77777777-7777-4777-8777-777777777777",
          app_metadata: { kiosk_pin_hash: "scrypt:abc:def" },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "PUT",
      body: JSON.stringify({
        id: "66666666-6666-4666-8666-666666666666",
        job_category: "funcionario",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_vip: false,
        job_category: "funcionario",
        perm_manage_assignments: false,
        role: "user",
      }),
    );
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "77777777-7777-4777-8777-777777777777",
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          kiosk_pin_hash: null,
          kiosk_pin_revoked_pending_notice: true,
        }),
      }),
    );
  });
});
