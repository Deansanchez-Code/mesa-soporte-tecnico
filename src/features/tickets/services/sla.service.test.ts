import { describe, it, expect } from "vitest";
import { SlaService } from "./sla.service";

describe("SlaService", () => {
  describe("determineInitialStatus", () => {
    it("should return PENDIENTE and running for normal tickets", () => {
      // Caso 1: Ticket de soporte estándar
      const result = SlaService.determineInitialStatus("Soporte General", null);

      expect(result).toEqual({
        status: "PENDIENTE",
        slaStatus: "running",
      });
    });

    it("should return PENDIENTE and running for auditorium tickets with close event date", () => {
      // Caso 2: Reserva para hoy/mañana (menos de 24h)
      // Simulamos que el evento es en 1 hora
      const eventDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const result = SlaService.determineInitialStatus(
        "Reserva Auditorio",
        eventDate,
      );

      expect(result).toEqual({
        status: "PENDIENTE",
        slaStatus: "running",
      });
    });

    it("should return EN_ESPERA and paused for auditorium tickets with distant event date", () => {
      // Caso 3: Reserva para dentro de 10 días
      const eventDate = new Date(
        Date.now() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = SlaService.determineInitialStatus(
        "Reserva Auditorio",
        eventDate,
      );

      expect(result).toEqual({
        status: "EN_ESPERA",
        slaStatus: "paused",
      });
    });

    it("should be case insensitive for category check", () => {
      const eventDate = new Date(
        Date.now() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = SlaService.determineInitialStatus(
        "reserva auditorio",
        eventDate,
      );

      expect(result).toEqual({
        status: "EN_ESPERA",
        slaStatus: "paused",
      });
    });

    it("should handle null eventDate for auditorium category gracefully (fallback to running)", () => {
      // Si por alguna razón es categoría auditorio pero no tiene fecha, no debería pausarse o fallar
      const result = SlaService.determineInitialStatus(
        "Reserva Auditorio",
        null,
      );

      expect(result).toEqual({
        status: "PENDIENTE",
        slaStatus: "running",
      });
    });
  });
});
