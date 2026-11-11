import crypto from "node:crypto";

export const KIOSK_PIN_REGEX = /^\d{6}$/;

export interface KioskIdentityCandidate {
  role?: string | null;
  username?: string | null;
  is_vip?: boolean | null;
  perm_manage_assignments?: boolean | null;
  job_category?: string | null;
}

/**
 * Determina si un usuario posee privilegios elevados en Kiosko
 * (VIP, coordinador o staff técnico), por lo cual requiere autenticación
 * estricta mediante PIN numérico de 6 dígitos asignado por SuperAdmin.
 */
export function isPrivilegedKioskUser(user: KioskIdentityCandidate): boolean {
  const roleLower = String(user.role || "")
    .toLowerCase()
    .trim();
  const jobCatLower = String(user.job_category || "")
    .toLowerCase()
    .trim();
  const usernameLower = String(user.username || "")
    .toLowerCase()
    .trim();

  if (user.is_vip === true || user.perm_manage_assignments === true) {
    return true;
  }
  if (["vip", "coordinator", "agent", "staff"].includes(roleLower)) {
    return true;
  }
  if (jobCatLower.includes("coordinador")) {
    return true;
  }
  if (["nbarrerac", "egutierrezn", "emgutierrezn"].includes(usernameLower)) {
    return true;
  }
  return false;
}

/**
 * Verifica si el correo pertenece al dominio institucional SENA o sintético local
 * (donde Exchange corporativo puede demorar >15 min en entregar correos SMTP externos).
 */
export function isInstitutionalDomainEmail(
  email: string | null | undefined,
): boolean {
  const normalized = String(email || "")
    .toLowerCase()
    .trim();
  if (!normalized || !normalized.includes("@")) return true;
  return (
    normalized.endsWith("@sena.edu.co") ||
    normalized.endsWith("@misena.edu.co") ||
    normalized.endsWith("@sistema.local")
  );
}

/**
 * Genera hash criptográfico `scrypt` con sal aleatoria por usuario para PIN de 6 dígitos.
 */
export function hashKioskPin(pin: string): string {
  if (!KIOSK_PIN_REGEX.test(pin)) {
    throw new Error("El PIN debe tener exactamente 6 dígitos numéricos");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

/**
 * Verifica un PIN ingresado contra el hash `scrypt` almacenado en app_metadata
 * utilizando comparación de tiempo constante.
 */
export function verifyKioskPin(pin: string, storedHash: unknown): boolean {
  if (!KIOSK_PIN_REGEX.test(pin) || typeof storedHash !== "string") {
    return false;
  }
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex || !/^[0-9a-f]+$/i.test(expectedHex)) {
    return false;
  }

  try {
    const derived = crypto.scryptSync(pin, salt, 32);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateRandomSixDigitPin(): string {
  return String(crypto.randomInt(100000, 1000000));
}
