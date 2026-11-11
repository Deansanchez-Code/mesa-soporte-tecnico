import { z } from "zod";

export const UUID_SCHEMA = z.string().uuid("Identificador UUID inválido");

export function isValidUuid(value: unknown): value is string {
  return UUID_SCHEMA.safeParse(value).success;
}

/**
 * Construye de forma segura un filtro PostgREST `.or()` para `auth_id`/`id`
 * exigiendo formato UUID estricto para prevenir inyección de operadores.
 */
export function buildUserIdOrFilter(id: string): string {
  const validId = UUID_SCHEMA.parse(id);
  return `auth_id.eq.${validId},id.eq.${validId}`;
}

/**
 * Sanitiza entradas de búsqueda usadas dentro de filtros `.or()` / `.ilike()`
 * eliminando delimitadores de sintaxis PostgREST (comas, paréntesis, comillas, comodines).
 */
export function sanitizePostgrestSearch(raw: string, maxLength = 80): string {
  return raw
    .replace(/[,()\\'"%]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Verifica que una ruta de almacenamiento o URL externa no contenga traversal ni esquemas peligrosos.
 */
export function isSafeStoragePathOrUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000) return false;
  if (
    trimmed.includes("..") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0")
  ) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/.test(lower) && !lower.startsWith("https://")) {
    return false;
  }
  return true;
}
