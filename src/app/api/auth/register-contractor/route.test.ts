import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockSingle }));
const mockOr = vi.fn(() => ({ limit: mockLimit }));
const mockSelect = vi.fn(() => ({ or: mockOr }));
const mockUpsert = vi.fn();
const mockCreateUser = vi.fn();

const mockAdmin = {
  from: vi.fn(() => ({
    select: mockSelect,
    upsert: mockUpsert,
  })),
  auth: {
    admin: {
      createUser: mockCreateUser,
    },
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockAdmin,
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("POST /api/auth/register-contractor Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "123e4567-e89b-12d3-a456-426614174000" } },
      error: null,
    });
  });

  it("rechaza intento de registrar rol superadmin/admin en payload", async () => {
    const req = new NextRequest(
      "http://localhost/api/auth/register-contractor",
      {
        method: "POST",
        body: JSON.stringify({
          username: "attacker",
          full_name: "Test User",
          email: "attacker@gmail.com",
          role: "superadmin",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("bloquea account takeover cuando el usuario ya existe (HTTP 409)", async () => {
    mockSingle.mockResolvedValue({ data: { id: "existing-uuid" } });

    const req = new NextRequest(
      "http://localhost/api/auth/register-contractor",
      {
        method: "POST",
        body: JSON.stringify({
          username: "nbarrerac",
          full_name: "Suplantador",
          email: "fake@gmail.com",
          role: "contractor",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("permite registro legítimo forzando rol contractor con secreto aleatorio", async () => {
    const req = new NextRequest(
      "http://localhost/api/auth/register-contractor",
      {
        method: "POST",
        headers: { "x-forwarded-for": "10.10.10.99" },
        body: JSON.stringify({
          username: "contratista.nuevo",
          full_name: "Contratista Prueba",
          email: "contratista.nuevo@gmail.com",
          role: "user",
          job_category: "funcionario",
        }),
      },
    );

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.user.role).toBe("contractor");
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        password: expect.not.stringMatching(/^Sena2024\*$/),
      }),
    );
    const createCall = mockCreateUser.mock.calls[0][0];
    expect(createCall.password.length).toBeGreaterThanOrEqual(20);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "contractor",
        is_vip: false,
        perm_manage_assignments: false,
      }),
      expect.anything(),
    );
  });
});
