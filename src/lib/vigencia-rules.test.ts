import { describe, it, expect } from "vitest";
import {
  isSupportRole,
  isSuperAdminRole,
  shouldDeactivateOnVigenciaRollover,
} from "./vigencia-rules";

describe("vigencia-rules", () => {
  it("identifica correctamente el rol de soporte técnico (agent)", () => {
    expect(isSupportRole("agent")).toBe(true);
    expect(isSupportRole("AGENT")).toBe(true);
    expect(isSupportRole("admin")).toBe(false);
    expect(isSupportRole(null)).toBe(false);
  });

  it("identifica correctamente el rol superadmin", () => {
    expect(isSuperAdminRole("superadmin")).toBe(true);
    expect(isSuperAdminRole("SuperAdmin")).toBe(true);
    expect(isSuperAdminRole("admin")).toBe(false);
  });

  it("desactiva contratistas y soportes en cambio de vigencia anual", () => {
    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "user",
        employment_type: "contratista",
        is_vip: false,
      }),
    ).toBe(true);

    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "agent",
        employment_type: "contratista",
        is_vip: false,
      }),
    ).toBe(true);

    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "agent",
        employment_type: "planta",
        is_vip: false,
      }),
    ).toBe(true);
  });

  it("mantiene activos a funcionarios de planta, VIP, Admin y Superadmin", () => {
    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "user",
        employment_type: "planta",
        is_vip: false,
      }),
    ).toBe(false);

    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "vip",
        employment_type: "contratista",
        is_vip: true,
      }),
    ).toBe(false);

    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "user",
        employment_type: "contratista",
        is_vip: true,
      }),
    ).toBe(false);

    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "admin",
        employment_type: "planta",
        is_vip: false,
      }),
    ).toBe(false);

    expect(
      shouldDeactivateOnVigenciaRollover({
        role: "superadmin",
        employment_type: "planta",
        is_vip: true,
      }),
    ).toBe(false);
  });
});
