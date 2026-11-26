/**
 * Reglas puras de negocio para visibilidad de ambientes, vigencia anual de reservas
 * y prevención de multi-reservas simultáneas en diferentes ambientes.
 */

export const ALL_SPECIAL_SPACE_IDS = ["1", "2", "3", "4", "5"] as const;
export const STANDARD_SPACE_IDS = ["1", "3", "4"] as const;
export const FIXED_RESERVATION_RESOURCES = [
  "Proyector",
  "Sonido",
  "Portátil",
] as const;

export interface ReservationActorLike {
  role?: string | null;
  employment_type?: string | null;
  job_category?: string | null;
  is_vip?: boolean | null;
  perm_manage_assignments?: boolean | null;
}

export interface ExistingReservationSlotLike {
  id?: number | string | null;
  auditorium_id?: string | null;
  start_time: string;
  end_time: string;
  status?: string | null;
  user_id?: string | null;
}

export function isPrivilegedSpaceUser(
  user?: ReservationActorLike | null,
): boolean {
  if (!user) return false;
  const roleLower = (user.role || "").trim().toLowerCase();
  const jobCatLower = (user.job_category || "").trim().toLowerCase();

  return (
    ["admin", "superadmin", "vip", "coordinator"].includes(roleLower) ||
    Boolean(user.is_vip) ||
    Boolean(user.perm_manage_assignments) ||
    jobCatLower.includes("coordinador")
  );
}

/**
 * Visibilidad por rol:
 * - Instructor y Planta (sin privilegio VIP/Admin/Coordinador): Auditorio 103 ("1"), Biblioteca ("3") y Ambiente 107 ("4").
 * - VIP, Coordinador, Admin y Superadmin: todos los 5 espacios ("1".."5").
 */
export function getVisibleSpaceIdsForUser(
  user?: ReservationActorLike | null,
): string[] {
  if (isPrivilegedSpaceUser(user)) {
    return [...ALL_SPECIAL_SPACE_IDS];
  }
  return [...STANDARD_SPACE_IDS];
}

/**
 * Vigencia anual de reservas:
 * - Usuarios de Planta (no contratistas), VIP, Coordinadores, Admin y Superadmin pueden consultar y reservar en la próxima vigencia.
 * - Instructores / contratistas sin privilegio VIP solo pueden reservar hasta el 31/12 de la vigencia actual.
 */
export function canAccessNextVigencia(
  user?: ReservationActorLike | null,
): boolean {
  if (!user) return false;
  if (isPrivilegedSpaceUser(user)) return true;

  const empLower = (user.employment_type || "").trim().toLowerCase();
  const roleLower = (user.role || "").trim().toLowerCase();

  if (empLower.includes("contratista") || roleLower === "contractor") {
    return false;
  }

  if (
    empLower.includes("planta") ||
    empLower.includes("oficial") ||
    empLower.includes("funcionario")
  ) {
    return true;
  }

  return false;
}

export function getBogotaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getBogotaYear(date = new Date()): number {
  return Number(getBogotaDateString(date).slice(0, 4));
}

export function getCurrentVigenciaEndDateStr(date = new Date()): string {
  return `${getBogotaYear(date)}-12-31`;
}

export function isDateBeyondCurrentVigencia(
  dateOrIsoStr: string,
  now = new Date(),
): boolean {
  const currentYear = getBogotaYear(now);
  const bogotaDate =
    dateOrIsoStr.length === 10
      ? dateOrIsoStr
      : getBogotaDateString(new Date(dateOrIsoStr));
  const targetYear = Number(bogotaDate.slice(0, 4));
  return Number.isFinite(targetYear) && targetYear > currentYear;
}

/**
 * Detecta si un mismo solicitante ya tiene una reserva activa/pendiente en OTRO ambiente
 * en un horario solapado, impidiendo multi-reservas simultáneas en diferentes ambientes.
 */
export function hasCrossSpaceOverlap(
  existingReservations: ExistingReservationSlotLike[],
  targetSpaceId: string,
  startIso: string,
  endIso: string,
  excludeReservationId?: number | string | null,
): ExistingReservationSlotLike | null {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  for (const res of existingReservations) {
    if (excludeReservationId != null && res.id === excludeReservationId) {
      continue;
    }
    const statusUpper = (res.status || "APPROVED").toUpperCase();
    if (statusUpper !== "APPROVED" && statusUpper !== "PENDING") {
      continue;
    }
    const resSpace = String(res.auditorium_id || "1");
    if (resSpace === String(targetSpaceId)) {
      continue;
    }

    const rStartMs = new Date(res.start_time).getTime();
    const rEndMs = new Date(res.end_time).getTime();
    if (startMs < rEndMs && endMs > rStartMs) {
      return res;
    }
  }
  return null;
}
