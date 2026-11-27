const CACHE_TTL_MS = 30_000;

let cachedPinAuthIds: Set<string> | null = null;
let cachedAtMs = 0;

/**
 * Caché temporal (30s) en memoria de proceso para evitar escanear hasta 3,000 usuarios
 * de Supabase Auth en cada apertura de pestañas administrativas.
 */
export function getCachedKioskPinSet(
  nowMs: number = Date.now(),
): Set<string> | null {
  if (!cachedPinAuthIds) return null;
  if (nowMs - cachedAtMs > CACHE_TTL_MS) {
    cachedPinAuthIds = null;
    cachedAtMs = 0;
    return null;
  }
  return new Set(cachedPinAuthIds);
}

export function setCachedKioskPinSet(
  authIds: Iterable<string>,
  nowMs: number = Date.now(),
): void {
  cachedPinAuthIds = new Set(authIds);
  cachedAtMs = nowMs;
}

export function markKioskPinCachedStatus(
  authId: string,
  hasPin: boolean,
): void {
  if (!authId || !cachedPinAuthIds) return;
  if (hasPin) {
    cachedPinAuthIds.add(authId);
  } else {
    cachedPinAuthIds.delete(authId);
  }
}

export function invalidateKioskPinCache(): void {
  cachedPinAuthIds = null;
  cachedAtMs = 0;
}
