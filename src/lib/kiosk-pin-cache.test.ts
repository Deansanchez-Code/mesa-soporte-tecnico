import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedKioskPinSet,
  invalidateKioskPinCache,
  markKioskPinCachedStatus,
  setCachedKioskPinSet,
} from "./kiosk-pin-cache";

describe("Caché TTL de estado PIN Kiosko", () => {
  beforeEach(() => {
    invalidateKioskPinCache();
  });

  it("almacena y devuelve copia del conjunto dentro del TTL de 30s", () => {
    setCachedKioskPinSet(["auth-1", "auth-2"], 1_000);
    const hit = getCachedKioskPinSet(20_000);
    expect(hit).not.toBeNull();
    expect(hit?.has("auth-1")).toBe(true);
    expect(hit?.has("auth-2")).toBe(true);

    // Expira después de 30,000 ms
    expect(getCachedKioskPinSet(32_000)).toBeNull();
  });

  it("permite actualización incremental O(1) al asignar o revocar PIN", () => {
    setCachedKioskPinSet(["auth-1"], 5_000);
    markKioskPinCachedStatus("auth-3", true);
    markKioskPinCachedStatus("auth-1", false);

    const hit = getCachedKioskPinSet(10_000);
    expect(hit?.has("auth-1")).toBe(false);
    expect(hit?.has("auth-3")).toBe(true);
  });
});
