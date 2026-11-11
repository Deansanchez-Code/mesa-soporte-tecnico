import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  mockSendEmail,
  mockGenerateLink,
  mockVerifyOtp,
  mockGetUserById,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockGenerateLink: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockGetUserById: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon",
    SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-role-key-for-hmac-test",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      update: () => ({ eq: vi.fn() }),
    }),
    auth: {
      admin: {
        getUserById: mockGetUserById,
        generateLink: mockGenerateLink,
      },
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: mockVerifyOtp,
    },
  }),
}));

vi.mock("@/lib/email/email-service", () => ({
  EmailService: {
    send: mockSendEmail,
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("POST /api/auth/kiosk-otp (ISO 27001 A.8.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        auth_id: "auth-123",
        username: "jperez",
        full_name: "Juan Perez",
        role: "user",
        area: "Sistemas",
        employment_type: "planta",
        job_category: "funcionario",
        email: "jperez@sena.edu.co",
        is_vip: false,
        perm_manage_assignments: false,
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({ data: { user: { id: "auth-123" } } });
    mockSendEmail.mockResolvedValue({ success: true });
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: "magic-hash-token" } },
      error: null,
    });
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: "acc-tok",
          refresh_token: "ref-tok",
        },
      },
      error: null,
    });
  });

  it("emite OTP por correo con cookie HttpOnly y permite verificar sesión sin contraseña fija", async () => {
    const req1 = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ action: "request", username: "jperez" }),
    });

    const res1 = await POST(req1);
    const json1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(json1.otpSent).toBe(true);
    expect(json1.maskedEmail).toContain("@sena.edu.co");

    const otpCookie = res1.cookies.get("kiosk_otp_challenge");
    expect(otpCookie?.value).toBeTruthy();

    const sentSubject = mockSendEmail.mock.calls[0][0].subject as string;
    const extractedCode = sentSubject.match(/\((\d{6})\)/)?.[1];
    expect(extractedCode).toHaveLength(6);

    // Intento fallido primero -> debe devolver 401
    const badVerifyReq = new NextRequest(
      "http://localhost/api/auth/kiosk-otp",
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "10.0.0.1",
          cookie: `kiosk_otp_challenge=${otpCookie!.value}`,
        },
        body: JSON.stringify({
          action: "verify",
          username: "jperez",
          code: "000000" === extractedCode ? "111111" : "000000",
        }),
      },
    );
    const badRes = await POST(badVerifyReq);
    expect(badRes.status).toBe(401);

    // Intento válido con cookie actualizada -> debe establecer sesión
    const updatedCookie = badRes.cookies.get("kiosk_otp_challenge")?.value;
    const okVerifyReq = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: {
        "x-forwarded-for": "10.0.0.1",
        cookie: `kiosk_otp_challenge=${updatedCookie}`,
      },
      body: JSON.stringify({
        action: "verify",
        username: "jperez",
        code: extractedCode,
      }),
    });
    const okRes = await POST(okVerifyReq);
    const okJson = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okJson.verified).toBe(true);
    expect(okJson.session.access_token).toBe("acc-tok");
  });

  it("bloquea envío de OTP a cuentas admin/superadmin", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "admin-uuid",
        username: "deansan",
        role: "superadmin",
        is_active: true,
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ action: "request", username: "deansan" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
