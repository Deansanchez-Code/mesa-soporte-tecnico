export const BACKUP_ADMIN_USERNAMES = [
  "superadmin",
  "admin",
  "dasanchezh",
] as const;

export const LIBRARY_STAFF_EMAILS = ["rbiblioteca@sistema.local"] as const;

export const SUBDIRECCION_AUTHORIZED_EMAIL = "emgutierrezn@sena.edu.co";

export interface DbPrivilegeSubject {
  role?: string | null;
  job_category?: string | null;
  is_vip?: boolean | null;
  perm_manage_assignments?: boolean | null;
}

function norm(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .trim();
}

export function isDbCoordinator(user?: DbPrivilegeSubject | null): boolean {
  if (!user) return false;
  const role = norm(user.role);
  const jobCat = norm(user.job_category);
  return (
    role === "coordinator" ||
    jobCat.includes("coordinador") ||
    Boolean(user.perm_manage_assignments)
  );
}

export function isDbPrivilegedUser(user?: DbPrivilegeSubject | null): boolean {
  if (!user) return false;
  const role = norm(user.role);
  return (
    ["admin", "superadmin", "coordinator", "vip"].includes(role) ||
    Boolean(user.is_vip) ||
    isDbCoordinator(user)
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
