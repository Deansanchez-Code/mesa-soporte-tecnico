import { describe, it, expect } from "vitest";
import {
  generateRandomSixDigitPin,
  hashKioskPin,
  isInstitutionalDomainEmail,
  isPrivilegedKioskUser,
  verifyKioskPin,
} from "./kiosk-pin";

describe("Seguridad PIN Kiosko VIP y clasificación de dominios", () => {
  it("hashea PIN de 6 dígitos con scrypt y sal única por usuario", () => {
    const hashA = hashKioskPin("482910");
    const hashB = hashKioskPin("482910");
    expect(hashA).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(hashA).not.toBe(hashB);
    expect(verifyKioskPin("482910", hashA)).toBe(true);
    expect(verifyKioskPin("482911", hashA)).toBe(false);
    expect(verifyKioskPin("12345", hashA)).toBe(false);
    expect(verifyKioskPin("482910", null)).toBe(false);
  });

  it("genera PIN numérico válido de 6 dígitos", () => {
    for (let i = 0; i < 10; i++) {
      expect(generateRandomSixDigitPin()).toMatch(/^\d{6}$/);
    }
  });

  it("identifica correctamente usuarios VIP/coordinadores y dominios institucionales", () => {
    expect(isPrivilegedKioskUser({ is_vip: true, role: "user" })).toBe(true);
    expect(
      isPrivilegedKioskUser({ is_vip: false, job_category: "Coordinador" }),
    ).toBe(true);
    expect(
      isPrivilegedKioskUser({
        is_vip: false,
        perm_manage_assignments: true,
        role: "user",
      }),
    ).toBe(true);
    expect(
      isPrivilegedKioskUser({
        is_vip: false,
        role: "user",
        job_category: "instructor",
      }),
    ).toBe(false);

    expect(isInstitutionalDomainEmail("docente@sena.edu.co")).toBe(true);
    expect(isInstitutionalDomainEmail("contratista@gmail.com")).toBe(false);
    expect(isInstitutionalDomainEmail("externo@hotmail.com")).toBe(false);
    expect(isInstitutionalDomainEmail("persona@outlook.com")).toBe(false);
  });
});
