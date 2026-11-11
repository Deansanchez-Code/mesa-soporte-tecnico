import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { hashKioskPin } from "@/lib/kiosk-pin";

const {
  mockSendEmail,
  mockGenerateLink,
  mockVerifyOtp,
  mockGetUserById,
  mockUpdateUserById,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockGenerateLink: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockGetUserById: vi.fn(),
  mockUpdateUserById: vi.fn(),
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
        updateUserById: mockUpdateUserById,
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

describe("POST /api/auth/kiosk-otp (PIN VIP + Directo SENA + OTP Personal)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUserById.mockResolvedValue({ error: null });
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

  it("permite ingreso directo sin correo para usuario estándar @sena.edu.co sin privilegios VIP", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        auth_id: "auth-123",
        username: "jperez",
        full_name: "Juan Perez",
        role: "user",
        area: "Sistemas",
        employment_type: "planta",
        job_category: "instructor",
        email: "jperez@sena.edu.co",
        is_vip: false,
        perm_manage_assignments: false,
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({ data: { user: { id: "auth-123" } } });

    const req = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.10" },
      body: JSON.stringify({ action: "request", username: "jperez" }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.authMode).toBe("direct");
    expect(json.verified).toBe(true);
    expect(json.session.access_token).toBe("acc-tok");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("exige PIN numérico de 6 dígitos (scrypt) para personal VIP / Coordinadores sin enviar correo SENA", async () => {
    const pinHash = hashKioskPin("654321");
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "vip-uuid-1",
        auth_id: "auth-vip-1",
        username: "nbarrerac",
        full_name: "Nury Barrera",
        role: "user",
        area: "Coordinación",
        employment_type: "planta",
        job_category: "coordinador",
        email: "nbarrerac@sena.edu.co",
        is_vip: true,
        perm_manage_assignments: true,
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: "auth-vip-1",
          app_metadata: { kiosk_pin_hash: pinHash },
        },
      },
    });

    const reqMode = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.11" },
      body: JSON.stringify({ action: "request", username: "nbarrerac" }),
    });
    const resMode = await POST(reqMode);
    const jsonMode = await resMode.json();
    expect(resMode.status).toBe(200);
    expect(jsonMode.authMode).toBe("pin");
    expect(mockSendEmail).not.toHaveBeenCalled();

    const badPinReq = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.11" },
      body: JSON.stringify({
        action: "verify_pin",
        username: "nbarrerac",
        pin: "000000",
      }),
    });
    const badPinRes = await POST(badPinReq);
    expect(badPinRes.status).toBe(401);

    const okPinReq = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.11" },
      body: JSON.stringify({
        action: "verify_pin",
        username: "nbarrerac",
        pin: "654321",
      }),
    });
    const okPinRes = await POST(okPinReq);
    const okPinJson = await okPinRes.json();
    expect(okPinRes.status).toBe(200);
    expect(okPinJson.verified).toBe(true);
    expect(okPinJson.session.access_token).toBe("acc-tok");
  });

  it("informa estado pin_not_configured cuando VIP no tiene PIN asignado aún", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "vip-uuid-2",
        auth_id: "auth-vip-2",
        username: "vipnuevo",
        full_name: "VIP Sin Pin",
        role: "vip",
        is_vip: true,
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: "auth-vip-2", app_metadata: {} } },
    });

    const req = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.12" },
      body: JSON.stringify({ action: "request", username: "vipnuevo" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.authMode).toBe("pin_not_configured");
    expect(json.pinConfigured).toBe(false);
    expect(json.message).toContain("Dinamizador TIC");
    expect(json.message).toContain("Deivis Andrés Sánchez");
    expect(json.message).toContain("Oficina de Sistemas");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("limpia PIN y devuelve pinRemovedNotice cuando a un ex-VIP se le retira privilegio VIP", async () => {
    const oldPinHash = hashKioskPin("112233");
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "exvip-uuid-1",
        auth_id: "auth-exvip-1",
        username: "exvipuser",
        full_name: "Ex VIP Usuario",
        role: "user",
        area: "Sistemas",
        employment_type: "planta",
        job_category: "instructor",
        email: "exvipuser@sena.edu.co",
        is_vip: false,
        perm_manage_assignments: false,
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: "auth-exvip-1",
          app_metadata: {
            kiosk_pin_hash: oldPinHash,
            kiosk_pin_revoked_pending_notice: true,
          },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.15" },
      body: JSON.stringify({ action: "request", username: "exvipuser" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.authMode).toBe("direct");
    expect(json.verified).toBe(true);
    expect(json.pinRemovedNotice).toBe(true);
    expect(mockUpdateUserById).toHaveBeenCalledWith("auth-exvip-1", {
      app_metadata: {
        kiosk_pin_hash: null,
        kiosk_pin_revoked_pending_notice: false,
      },
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("emite OTP por correo personal cuando el dominio no es institucional (@gmail/@hotmail/@outlook)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "contractor-uuid-1",
        auth_id: "auth-c-1",
        username: "crodriguez",
        full_name: "Carlos Rodriguez",
        role: "contractor",
        area: "Sistemas",
        employment_type: "contratista",
        job_category: "funcionario",
        email: "crodriguez@gmail.com",
        is_vip: false,
        perm_manage_assignments: false,
        is_active: true,
      },
      error: null,
    });
    mockGetUserById.mockResolvedValue({ data: { user: { id: "auth-c-1" } } });

    const req1 = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.13" },
      body: JSON.stringify({ action: "request", username: "crodriguez" }),
    });

    const res1 = await POST(req1);
    const json1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(json1.authMode).toBe("otp");
    expect(json1.otpSent).toBe(true);
    expect(json1.maskedEmail).toContain("@gmail.com");

    const otpCookie = res1.cookies.get("kiosk_otp_challenge");
    expect(otpCookie?.value).toBeTruthy();

    const sentSubject = mockSendEmail.mock.calls[0][0].subject as string;
    const extractedCode = sentSubject.match(/\((\d{6})\)/)?.[1];
    expect(extractedCode).toHaveLength(6);

    const okVerifyReq = new NextRequest("http://localhost/api/auth/kiosk-otp", {
      method: "POST",
      headers: {
        "x-forwarded-for": "10.0.0.13",
        cookie: `kiosk_otp_challenge=${otpCookie!.value}`,
      },
      body: JSON.stringify({
        action: "verify",
        username: "crodriguez",
        code: extractedCode,
      }),
    });
    const okRes = await POST(okVerifyReq);
    const okJson = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okJson.verified).toBe(true);
    expect(okJson.session.access_token).toBe("acc-tok");
  });

  it("bloquea envío de acceso Kiosko a cuentas admin/superadmin", async () => {
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
      headers: { "x-forwarded-for": "10.0.0.14" },
      body: JSON.stringify({ action: "request", username: "deansan" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
