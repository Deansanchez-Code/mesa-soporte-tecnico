import { describe, it, expect } from "vitest";
import {
  getSpaceDisplayName,
  hasValidDescription,
  isBackupAdminIdentity,
  isDbCoordinator,
  isDbPrivilegedUser,
  isLibraryStaffEmail,
  resolveReservationUserEmail,
} from "./reservationHelpers";

describe("Helpers puros de reservas y coordinaciones", () => {
  it("resuelve correo institucional SENA para funcionarios de planta/coordinadores y personal para externos", () => {
    expect(
      resolveReservationUserEmail({
        username: "NBARRERAC",
        email: "nbarrerac@sistema.local",
        employment_type: "planta",
      }),
    ).toBe("nbarrerac@sena.edu.co");

    expect(
      resolveReservationUserEmail({
        username: "contractor1",
        email: "contractor1@gmail.com",
        employment_type: "contratista",
      }),
    ).toBe("contractor1@gmail.com");

    expect(resolveReservationUserEmail(null)).toBe("");
  });

  it("filtra descripciones vacías o sin requerimientos reales", () => {
    expect(hasValidDescription("Ninguno")).toBe(false);
    expect(hasValidDescription("no aplica.")).toBe(false);
    expect(hasValidDescription("Video beam y sonido")).toBe(true);
  });

  it("evalúa privilegios por campos autoritativos de BD y no por username hardcoded", () => {
    expect(getSpaceDisplayName("4")).toBe("Ambiente 107");
    expect(getSpaceDisplayName("5")).toBe("Ambiente de Cocina");
    expect(getSpaceDisplayName("99", "Sala Juntas")).toBe("Sala Juntas");

    expect(isBackupAdminIdentity("dasanchezh", null)).toBe(true);
    expect(isLibraryStaffEmail("rbiblioteca@sistema.local")).toBe(true);
    expect(isLibraryStaffEmail("egutierrezn@sistema.local")).toBe(false);

    // Ex-coordinadora egutierrezn con flags revocados en BD no conserva privilegios
    const revokedUser = {
      role: "user",
      job_category: "funcionario",
      is_vip: false,
      perm_manage_assignments: false,
    };
    expect(isDbCoordinator(revokedUser)).toBe(false);
    expect(isDbPrivilegedUser(revokedUser)).toBe(false);

    expect(isDbCoordinator({ perm_manage_assignments: true })).toBe(true);
    expect(isDbCoordinator({ job_category: "Coordinador Académico" })).toBe(
      true,
    );
    expect(isDbPrivilegedUser({ is_vip: true, role: "user" })).toBe(true);
    expect(isDbPrivilegedUser({ role: "admin" })).toBe(true);
  });
});
