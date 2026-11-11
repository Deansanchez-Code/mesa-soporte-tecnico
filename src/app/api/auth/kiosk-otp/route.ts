import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { EmailService } from "@/lib/email/email-service";
import { KioskOtpEmail } from "@/lib/email/templates/KioskOtpEmail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { env } from "@/env";
import Logger from "@/lib/logger";

const OTP_COOKIE_NAME = "kiosk_otp_challenge";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_TRIES = 5;

const RequestOtpSchema = z.object({
  action: z.literal("request"),
  username: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/),
});

const VerifyOtpSchema = z.object({
  action: z.literal("verify"),
  username: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

interface OtpChallengePayload {
  cid: string;
  uid: string;
  uname: string;
  syn: string;
  h: string;
  exp: number;
  tries: number;
}

function getOtpHmacKey(): Buffer {
  const secret = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY es requerida para firmar desafíos OTP.",
    );
  }
  return crypto.createHmac("sha256", "kiosk-otp-v1").update(secret).digest();
}

function hashOtpCode(cid: string, uid: string, code: string): string {
  return crypto
    .createHmac("sha256", getOtpHmacKey())
    .update(`${cid}:${uid}:${code}`)
    .digest("hex");
}

function signChallenge(payload: OtpChallengePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = crypto
    .createHmac("sha256", getOtpHmacKey())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyChallengeToken(token: string): OtpChallengePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getOtpHmacKey())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as OtpChallengePayload;
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const prefix = local.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function resolveOtpRecipientEmail(user: {
  username: string;
  email?: string | null;
  employment_type?: string | null;
  job_category?: string | null;
}): string {
  const cleanUser = user.username.toLowerCase().trim();
  const empType = (user.employment_type || "").toLowerCase();
  const jobCat = (user.job_category || "").toLowerCase();
  const rawEmail = (user.email || "").trim().toLowerCase();

  const isOfficial =
    empType.includes("planta") ||
    empType.includes("funcionario") ||
    empType.includes("oficial") ||
    jobCat.includes("coordinador");

  if (isOfficial && cleanUser) {
    return `${cleanUser}@sena.edu.co`;
  }
  if (
    rawEmail &&
    rawEmail.includes("@") &&
    !rawEmail.endsWith("@sistema.local")
  ) {
    return rawEmail;
  }
  return `${cleanUser}@sena.edu.co`;
}

function setChallengeCookie(res: NextResponse, token: string) {
  res.cookies.set(OTP_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/kiosk-otp",
    maxAge: 600,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();

    if (body?.action === "request") {
      const parsed = RequestOtpSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Usuario inválido" },
          { status: 400 },
        );
      }

      const cleanUsername = parsed.data.username.toLowerCase().trim();
      const ipLimit = checkRateLimit(`otp-req-ip:${ip}`, 20, 10 * 60 * 1000);
      const userLimit = checkRateLimit(
        `otp-req-user:${ip}:${cleanUsername}`,
        5,
        5 * 60 * 1000,
      );
      if (!ipLimit.allowed || !userLimit.allowed) {
        return NextResponse.json(
          {
            error:
              "Demasiados intentos. Por seguridad espera unos minutos antes de solicitar otro código.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.max(
                  ipLimit.retryAfterSeconds,
                  userLimit.retryAfterSeconds,
                ),
              ),
            },
          },
        );
      }

      const supabaseAdmin = getSupabaseAdmin();
      const { data: publicUser, error } = await supabaseAdmin
        .from("users")
        .select(
          "id, username, full_name, role, area, employment_type, job_category, auth_id, email, is_vip, perm_manage_assignments, is_active",
        )
        .eq("username", cleanUsername)
        .maybeSingle();

      if (error) {
        Logger.error("Error querying user for Kiosk OTP", error);
        return NextResponse.json(
          { error: "Error consultando usuario" },
          { status: 500 },
        );
      }

      if (!publicUser) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 },
        );
      }

      if (publicUser.is_active === false) {
        return NextResponse.json(
          { error: "Cuenta inactiva. Contacta a Soporte TIC." },
          { status: 403 },
        );
      }

      const roleLower = String(publicUser.role || "").toLowerCase();
      if (roleLower === "admin" || roleLower === "superadmin") {
        return NextResponse.json(
          {
            error:
              "Los administradores deben ingresar por /login o usar su cuenta de funcionario/instructor.",
          },
          { status: 403 },
        );
      }

      const syntheticEmail = `${cleanUsername}@sistema.local`;
      let authId = publicUser.auth_id;

      // Lazy-provision Auth user ONLY if missing, with 32-byte random secret (never hardcoded password)
      let authExists = false;
      if (authId) {
        const { data: existingAuth } =
          await supabaseAdmin.auth.admin.getUserById(authId);
        if (existingAuth?.user) {
          authExists = true;
        }
      }

      if (!authExists) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const matched = listData?.users.find(
          (u) => u.email?.toLowerCase() === syntheticEmail,
        );
        if (matched) {
          authExists = true;
          authId = matched.id;
        }
      }

      if (!authExists) {
        const randomPassword = crypto.randomBytes(32).toString("base64url");
        const { data: createdAuth, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email: syntheticEmail,
            password: randomPassword,
            email_confirm: true,
            user_metadata: {
              full_name: publicUser.full_name,
              role: publicUser.role,
              area: publicUser.area,
              username: cleanUsername,
            },
          });

        if (createErr || !createdAuth?.user) {
          Logger.error("Error provisioning Auth user for OTP", createErr);
          return NextResponse.json(
            { error: "No fue posible preparar el acceso del usuario" },
            { status: 500 },
          );
        }
        authId = createdAuth.user.id;
      }

      if (authId && authId !== publicUser.auth_id) {
        await supabaseAdmin
          .from("users")
          .update({ auth_id: authId })
          .eq("id", publicUser.id);
      }

      const otpCode = String(crypto.randomInt(100000, 1000000));
      const cid = crypto.randomUUID();
      const recipientEmail = resolveOtpRecipientEmail({
        username: cleanUsername,
        email: publicUser.email,
        employment_type: publicUser.employment_type,
        job_category: publicUser.job_category,
      });

      const emailRes = await EmailService.send({
        to: recipientEmail,
        subject: `Código de Acceso (${otpCode}) — Mesa de Ayuda TIC`,
        react: KioskOtpEmail({
          userName: publicUser.full_name || cleanUsername,
          otpCode,
          expiresMinutes: 10,
        }),
      });

      if (!emailRes.success) {
        Logger.error("Failed sending Kiosk OTP email", emailRes.error);
        return NextResponse.json(
          {
            error:
              "No fue posible enviar el código al correo registrado. Contacta a Mesa de Ayuda TIC.",
          },
          { status: 503 },
        );
      }

      const token = signChallenge({
        cid,
        uid: publicUser.id,
        uname: cleanUsername,
        syn: syntheticEmail,
        h: hashOtpCode(cid, publicUser.id, otpCode),
        exp: Date.now() + OTP_TTL_MS,
        tries: MAX_OTP_TRIES,
      });

      const res = NextResponse.json({
        otpSent: true,
        maskedEmail: maskEmail(recipientEmail),
      });
      setChallengeCookie(res, token);
      return res;
    }

    if (body?.action === "verify") {
      const parsed = VerifyOtpSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Código o usuario inválido" },
          { status: 400 },
        );
      }

      const ipVerifyLimit = checkRateLimit(
        `otp-verify-ip:${ip}`,
        15,
        10 * 60 * 1000,
      );
      if (!ipVerifyLimit.allowed) {
        return NextResponse.json(
          {
            error: "Demasiados intentos de verificación. Espera unos minutos.",
          },
          { status: 429 },
        );
      }

      const rawCookie = req.cookies.get(OTP_COOKIE_NAME)?.value;
      if (!rawCookie) {
        return NextResponse.json(
          { error: "Sesión de código expirada. Solicita un nuevo código." },
          { status: 401 },
        );
      }

      const challenge = verifyChallengeToken(rawCookie);
      if (!challenge || challenge.exp <= Date.now() || challenge.tries <= 0) {
        const expiredRes = NextResponse.json(
          { error: "El código ha expirado. Solicita uno nuevo." },
          { status: 401 },
        );
        expiredRes.cookies.delete(OTP_COOKIE_NAME);
        return expiredRes;
      }

      const cleanUsername = parsed.data.username.toLowerCase().trim();
      if (challenge.uname !== cleanUsername) {
        return NextResponse.json(
          { error: "El código no corresponde a este usuario." },
          { status: 401 },
        );
      }

      const suppliedHash = hashOtpCode(
        challenge.cid,
        challenge.uid,
        parsed.data.code,
      );
      const validCode = crypto.timingSafeEqual(
        Buffer.from(suppliedHash, "hex"),
        Buffer.from(challenge.h, "hex"),
      );

      if (!validCode) {
        const remainingTries = challenge.tries - 1;
        const failRes = NextResponse.json(
          {
            error:
              remainingTries > 0
                ? `Código incorrecto. Te quedan ${remainingTries} intento(s).`
                : "Código bloqueado por intentos fallidos. Solicita un código nuevo.",
          },
          { status: 401 },
        );
        if (remainingTries <= 0) {
          failRes.cookies.delete(OTP_COOKIE_NAME);
        } else {
          setChallengeCookie(
            failRes,
            signChallenge({ ...challenge, tries: remainingTries }),
          );
        }
        return failRes;
      }

      // Código válido -> emitir sesión Supabase real vía Magic-Link Token Exchange
      const supabaseAdmin = getSupabaseAdmin();
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: challenge.syn,
        });

      const tokenHash = linkData?.properties?.hashed_token;
      if (linkError || !tokenHash) {
        Logger.error(
          "Error generating magiclink token for OTP verify",
          linkError,
        );
        return NextResponse.json(
          { error: "No fue posible iniciar la sesión" },
          { status: 500 },
        );
      }

      const ssrClient = await createClient();
      const { data: verifyData, error: verifyError } =
        await ssrClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });

      if (verifyError || !verifyData.session) {
        Logger.error("Error verifying magiclink OTP", verifyError);
        return NextResponse.json(
          { error: "Error estableciendo sesión autenticada" },
          { status: 500 },
        );
      }

      const { data: publicUser } = await supabaseAdmin
        .from("users")
        .select(
          "id, username, full_name, role, area, employment_type, job_category, email, is_vip, perm_manage_assignments",
        )
        .eq("id", challenge.uid)
        .maybeSingle();

      const okRes = NextResponse.json({
        verified: true,
        user: publicUser,
        session: {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        },
      });
      okRes.cookies.delete(OTP_COOKIE_NAME);
      return okRes;
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    Logger.error("Kiosk OTP endpoint failure", error);
    return NextResponse.json(
      { error: "Error procesando verificación de acceso" },
      { status: 500 },
    );
  }
}
