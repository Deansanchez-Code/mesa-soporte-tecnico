import { describe, it, expect } from "vitest";
import {
  buildUserIdOrFilter,
  isSafeStoragePathOrUrl,
  isValidUuid,
  sanitizePostgrestSearch,
} from "./security";

describe("Security Hardening Helpers (ISO 27001)", () => {
  it("valida UUIDs estrictamente y bloquea inyección en filtros .or()", () => {
    const validId = "123e4567-e89b-12d3-a456-426614174000";
    expect(isValidUuid(validId)).toBe(true);
    expect(buildUserIdOrFilter(validId)).toBe(
      `auth_id.eq.${validId},id.eq.${validId}`,
    );

    expect(isValidUuid("123,role.eq.superadmin")).toBe(false);
    expect(() => buildUserIdOrFilter("123,role.eq.superadmin")).toThrow();
  });

  it("sanitiza cadenas de búsqueda PostgREST eliminando delimitadores de sintaxis", () => {
    expect(sanitizePostgrestSearch("hp laser,or(role.eq.superadmin)%")).toBe(
      "hp laserorrole.eq.superadmin",
    );
    expect(sanitizePostgrestSearch("SN-2026-001")).toBe("SN-2026-001");
    expect(sanitizePostgrestSearch("x".repeat(120), 20)).toHaveLength(20);
  });

  it("rechaza path traversal y esquemas peligrosos en rutas de almacenamiento", () => {
    expect(isSafeStoragePathOrUrl("transfer/doc-123.pdf")).toBe(true);
    expect(
      isSafeStoragePathOrUrl("https://project.supabase.co/storage/v1/a.pdf"),
    ).toBe(true);
    expect(isSafeStoragePathOrUrl("../../etc/passwd")).toBe(false);
    expect(isSafeStoragePathOrUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeStoragePathOrUrl("data:text/html,<script>1</script>")).toBe(
      false,
    );
    expect(isSafeStoragePathOrUrl("http://insecure.local/file.pdf")).toBe(
      false,
    );
  });
});
