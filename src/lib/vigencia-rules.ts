/**
 * Reglas puras de vigencia anual y gobernanza de soportes técnicos.
 * Permiten validar tanto en API Routes como en pruebas unitarias sin acoplarse a Supabase.
 */

export interface VigenciaUserLike {
  role?: string | null;
  employment_type?: string | null;
  is_vip?: boolean | null;
}

export function isSupportRole(role?: string | null): boolean {
  return (role || "").trim().toLowerCase() === "agent";
}

export function isSuperAdminRole(role?: string | null): boolean {
  return (role || "").trim().toLowerCase() === "superadmin";
}

/**
 * En cambio de vigencia anual:
 * - Se desactivan contratistas (`employment_type === "contratista"`) y soportes (`role === "agent"`).
 * - Permanecen activos funcionarios de planta, usuarios VIP y administradores/superadmin.
 */
export function shouldDeactivateOnVigenciaRollover(
  user: VigenciaUserLike,
): boolean {
  const roleLower = (user.role || "").trim().toLowerCase();
  const empLower = (user.employment_type || "").trim().toLowerCase();

  if (
    roleLower === "superadmin" ||
    roleLower === "admin" ||
    roleLower === "vip" ||
    Boolean(user.is_vip)
  ) {
    return false;
  }

  if (roleLower === "agent") {
    return true;
  }

  if (empLower === "contratista") {
    return true;
  }

  return false;
}
