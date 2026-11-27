export const BACKUP_ADMIN_USERNAMES = [
  "superadmin",
  "admin",
  "dasanchezh",
] as const;

export const LEGACY_COORDINATOR_USERNAMES = [
  "nbarrerac",
  "egutierrezn",
  "emgutierrezn",
] as const;

export const COORDINATOR_PRIVILEGE_USERNAMES = [
  "nbarrerac",
  "egutierrezn",
  "emgutierrezn",
  "dasanchezh",
] as const;

export const LIBRARY_STAFF_EMAILS = [
  "egutierrezn@sistema.local",
  "rbiblioteca@sistema.local",
] as const;

export const LIBRARY_APPROVER_EMAILS = [
  "dasanchezh@sena.edu.co",
  "egutierrezn@sena.edu.co",
  "egutierrezn@sistema.local",
  "emgutierrezn@sena.edu.co",
  "emgutierrezn@sistema.local",
] as const;

export const LIBRARY_STAFF_USERNAMES = [
  "egutierrezn",
  "rbiblioteca",
  "emgutierrezn",
] as const;

export const AMBIENTE_107_APPROVER_IDENTIFIERS = [
  "nbarrerac@sena.edu.co",
  "nbarrerac",
  "dasanchezh@sena.edu.co",
  "dasanchezh",
] as const;

export const SUBDIRECCION_AUTHORIZED_EMAIL = "emgutierrezn@sena.edu.co";

function norm(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .trim();
}

export function isLegacyCoordinatorUsername(username?: string | null): boolean {
  const clean = norm(username);
  return (LEGACY_COORDINATOR_USERNAMES as readonly string[]).includes(clean);
}

export function isCoordinatorPrivilegeUsername(
  username?: string | null,
): boolean {
  const clean = norm(username);
  return (COORDINATOR_PRIVILEGE_USERNAMES as readonly string[]).includes(clean);
}

export function isCoordinatorIdentityMatch(
  username?: string | null,
  email?: string | null,
): boolean {
  const cleanU = norm(username);
  const cleanE = norm(email);
  return COORDINATOR_PRIVILEGE_USERNAMES.some(
    (allowed) => cleanU.includes(allowed) || cleanE.includes(allowed),
  );
}

export function isBackupAdminIdentity(
  username?: string | null,
  email?: string | null,
): boolean {
  const cleanU = norm(username);
  const cleanE = norm(email);
  return (
    (BACKUP_ADMIN_USERNAMES as readonly string[]).includes(cleanU) ||
    cleanE.includes("dasanchezh")
  );
}

export function isLibraryStaffEmail(email?: string | null): boolean {
  return (LIBRARY_STAFF_EMAILS as readonly string[]).includes(norm(email));
}

export function isLibraryApproverIdentity(
  username?: string | null,
  email?: string | null,
): boolean {
  const cleanU = norm(username);
  const cleanE = norm(email);
  return (
    (LIBRARY_APPROVER_EMAILS as readonly string[]).includes(cleanE) ||
    (LIBRARY_STAFF_USERNAMES as readonly string[]).includes(cleanU)
  );
}

export function isLibraryVisibleIdentity(
  username?: string | null,
  email?: string | null,
): boolean {
  const cleanU = norm(username);
  const cleanE = norm(email);
  return (
    (
      [...LIBRARY_STAFF_EMAILS, "emgutierrezn@sena.edu.co"] as readonly string[]
    ).includes(cleanE) ||
    (LIBRARY_STAFF_USERNAMES as readonly string[]).includes(cleanU)
  );
}

export function isAmbiente107ApproverIdentity(
  username?: string | null,
  email?: string | null,
): boolean {
  const cleanU = norm(username);
  const cleanE = norm(email);
  return AMBIENTE_107_APPROVER_IDENTIFIERS.some(
    (allowed) => cleanE.includes(allowed) || cleanU.includes(allowed),
  );
}

export function hasValidDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  const trimmed = desc.trim();
  if (trimmed.length === 0) return false;
  const normalized = trimmed
    .toLowerCase()
    .replace(/[.,\-_/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const blacklist = [
    "ninguno",
    "ninguna",
    "no",
    "na",
    "no aplica",
    "sin requerimientos",
    "ningun",
    "0",
    "ningunos",
    "ningunas",
    "nada",
    "sin novedad",
  ];
  return !blacklist.includes(normalized) && normalized.length > 0;
}

/**
 * Resuelve el correo electrónico real del titular/responsable de la reserva:
 * - Funcionarios de planta / oficiales / coordinadores -> {username}@sena.edu.co
 * - Contratistas / externos -> correo registrado (si no es @sistema.local), o fallback a {username}@sena.edu.co
 */
export function resolveReservationUserEmail(
  user:
    | {
        email?: string | null;
        username?: string | null;
        employment_type?: string | null;
        job_category?: string | null;
      }
    | null
    | undefined,
): string {
  if (!user) return "";
  const empType = (user.employment_type || "").toLowerCase();
  const jobCat = (user.job_category || "").toLowerCase();
  const isOfficial =
    empType.includes("planta") ||
    empType.includes("funcionario") ||
    empType.includes("oficial") ||
    jobCat.includes("coordinador");

  const rawEmail = norm(user.email);
  const cleanUser = norm(user.username);

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
  if (cleanUser) {
    return `${cleanUser}@sena.edu.co`;
  }
  return "";
}

export function getSpaceDisplayName(
  auditoriumId?: string | number | null,
  fallbackName?: string,
): string {
  const id = String(auditoriumId || "1");
  if (id === "2") return "Subdirección";
  if (id === "3") return "Biblioteca";
  if (id === "4") return "Ambiente 107";
  if (id === "5") return "Ambiente de Cocina";
  if (id === "1") return "Auditorio 103";
  return fallbackName || "Espacio Institucional";
}
