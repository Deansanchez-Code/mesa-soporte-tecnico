import { describe, it, expect } from "vitest";
import {
  getSpaceDisplayName,
  hasValidDescription,
  isAmbiente107ApproverIdentity,
  isBackupAdminIdentity,
  isCoordinatorPrivilegeUsername,
  isLegacyCoordinatorUsername,
  isLibraryApproverIdentity,
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

  it("identifica nombres de espacios e identidades de coordinación", () => {
    expect(getSpaceDisplayName("4")).toBe("Ambiente 107");
    expect(getSpaceDisplayName("5")).toBe("Ambiente de Cocina");
    expect(getSpaceDisplayName("99", "Sala Juntas")).toBe("Sala Juntas");

    expect(isLegacyCoordinatorUsername("egutierrezn")).toBe(true);
    expect(isCoordinatorPrivilegeUsername("dasanchezh")).toBe(true);
    expect(isBackupAdminIdentity("dasanchezh", null)).toBe(true);
    expect(isLibraryApproverIdentity("egutierrezn", null)).toBe(true);
    expect(isAmbiente107ApproverIdentity("nbarrerac", null)).toBe(true);
    expect(isAmbiente107ApproverIdentity("jperez", "jperez@sena.edu.co")).toBe(
      false,
    );
  });
});
