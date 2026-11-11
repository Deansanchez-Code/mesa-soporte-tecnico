import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyKioskPin } from "@/lib/kiosk-pin";

const {
  mockVerifyPermissions,
  mockMaybeSingle,
  mockGetUserById,
  mockUpdateUserById,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockVerifyPermissions: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockGetUserById: vi.fn(),
  mockUpdateUserById: vi.fn(),
  mockAuditInsert: vi.fn(),
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
      handler(req, { user: { id: "superadmin-auth-id" } }),
}));

vi.mock("@/lib/auth-check", () => ({
  verifyUserPermissions: mockVerifyPermissions,
  forbidden: (msg?: string) =>
    new Response(JSON.stringify({ error: msg || "Forbidden" }), {
      status: 403,
    }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "audit_logs") {
        return { insert: mockAuditInsert };
      }
      return {
        select: () => ({
          or: () => ({
            maybeSingle: mockMaybeSingle,
          }),
        }),
        update: () => ({ eq: vi.fn() }),
      };
    },
    auth: {
      admin: {
        getUserById: mockGetUserById,
        updateUserById: mockUpdateUserById,
      },
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("POST /api/admin/users/pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPermissions.mockResolvedValue(true);
    mockAuditInsert.mockResolvedValue({ error: null });
    mockUpdateUserById.mockResolvedValue({ error: null });
  });

  it("rechaza usuarios no superadmin con 403", async () => {
    mockVerifyPermissions.mockResolvedValue(false);
    const req = new NextRequest("http://localhost/api/admin/users/pin", {
      method: "POST",
      body: JSON.stringify({
        userId: "123e4567-e89b-12d3-a456-426614174000",
        pin: "482910",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("rechaza PIN que no sea exactamente 6 dígitos", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/pin", {
      method: "POST",
      body: JSON.stringify({
        userId: "123e4567-e89b-12d3-a456-426614174000",
        pin: "12ab56",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("guarda PIN hasheado en app_metadata sin exponer texto plano", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        auth_id: "auth-vip-id",
        username: "nbarrerac",
        full_name: "Nury Barrera",
        role: "user",
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: "auth-vip-id", app_metadata: { existing: true } } },
    });

    const req = new NextRequest("http://localhost/api/admin/users/pin", {
      method: "POST",
      body: JSON.stringify({
        userId: "123e4567-e89b-12d3-a456-426614174000",
        pin: "839201",
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.has_kiosk_pin).toBe(true);

    const savedAppMeta = mockUpdateUserById.mock.calls[0][1].app_metadata;
    expect(savedAppMeta.existing).toBe(true);
    expect(savedAppMeta.kiosk_pin_hash).toMatch(/^scrypt:/);
    expect(savedAppMeta.kiosk_pin_hash).not.toContain("839201");
    expect(verifyKioskPin("839201", savedAppMeta.kiosk_pin_hash)).toBe(true);
  });
});
