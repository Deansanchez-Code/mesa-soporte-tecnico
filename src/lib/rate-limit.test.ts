import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("Rate Limiter (ISO 27001 A.8.6)", () => {
  it("bloquea peticiones al superar el umbral permitido", () => {
    const key = `test-rl-${Date.now()}`;
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);

    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
