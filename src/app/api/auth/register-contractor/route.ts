import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import Logger from "@/lib/logger";

const RegisterContractorSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, "Usuario contiene caracteres inválidos"),
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email("Correo inválido").max(160),
  role: z.enum(["contractor", "instructor", "user"]).optional(),
  area: z.string().trim().max(120).optional(),
  job_category: z.enum(["instructor", "funcionario"]).optional(),
});

export async function POST(req: NextRequest) {
  // AUTH_CHECK_BYPASS: Public registration endpoint (Zod Validated, Rate-Limited & Role Locked)
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`reg-contractor:${ip}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiados registros recientes. Espera unos minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const body = await req.json();
    const parsed = RegisterContractorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de registro inválidos" },
        { status: 400 },
      );
    }

    const { username, full_name, email, role, area, job_category } =
      parsed.data;

    // Validation: Reject corporate emails
    if (email.toLowerCase().endsWith("@sena.edu.co")) {
      return NextResponse.json(
        { error: "Corporate emails not allowed for contractors" },
        { status: 400 },
      );
    }

    // ISO 27001 A.8.2: Coerción estricta de rol no privilegiado (nunca admin/superadmin/vip)
    const safeRole: "contractor" | "instructor" =
      role === "instructor" ? "instructor" : "contractor";
    const final_job_category =
      job_category ||
      (safeRole === "instructor" ? "instructor" : "funcionario");
    const final_employment_type = "contratista";

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();
    const syntheticEmail = `${cleanUsername}@sistema.local`;

    // ISO 27001 A.8.5: Impedir toma de cuenta (account takeover) si ya existe usuario previo
    const { data: existingPublic } = await supabaseAdmin
      .from("users")
      .select("id")
      .or(`username.eq.${cleanUsername},email.eq.${cleanEmail}`)
      .limit(1)
      .maybeSingle();

    if (existingPublic) {
      return NextResponse.json(
        {
          error:
            "El usuario ya se encuentra registrado. Por favor inicia sesión con tu cuenta existente.",
        },
        { status: 409 },
      );
    }

    // 1. Create Auth User con contraseña criptográfica aleatoria por usuario (acceso vía OTP)
    const randomSecret = crypto.randomBytes(32).toString("base64url");
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: randomSecret,
        email_confirm: true,
        user_metadata: {
          full_name,
          username: cleanUsername,
          role: safeRole,
          area,
          job_category: final_job_category,
          employment_type: final_employment_type,
          real_email: cleanEmail,
        },
      });

    if (authError) {
      if (authError.message.toLowerCase().includes("already been registered")) {
        return NextResponse.json(
          {
            error:
              "El identificador de usuario ya existe en el sistema de autenticación.",
          },
          { status: 409 },
        );
      }
      throw authError;
    }

    const userId = authUser?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "No se pudo completar el registro" },
        { status: 500 },
      );
    }

    // 2. Insertar registro en tabla pública usando estrictamente safeRole
    const { error: publicError } = await supabaseAdmin.from("users").upsert(
      {
        id: userId,
        auth_id: userId,
        email: cleanEmail,
        full_name,
        username: cleanUsername,
        role: safeRole,
        area: area || null,
        job_category: final_job_category,
        employment_type: final_employment_type,
        is_vip: false,
        perm_manage_assignments: false,
        is_active: true,
      },
      { onConflict: "id" },
    );

    if (publicError) {
      Logger.error(
        "Public user upsert error on contractor registration",
        publicError,
      );
      return NextResponse.json(
        { error: "Error al registrar perfil de contratista" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      user: {
        id: userId,
        username: cleanUsername,
        full_name,
        email: cleanEmail,
        role: safeRole,
        job_category: final_job_category,
        employment_type: final_employment_type,
      },
    });
  } catch (error: unknown) {
    Logger.error("Error creating contractor user", error);
    return NextResponse.json(
      { error: "No fue posible procesar el registro de contratista" },
      { status: 500 },
    );
  }
}
