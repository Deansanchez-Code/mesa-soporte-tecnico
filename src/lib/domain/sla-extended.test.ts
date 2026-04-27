import { describe, it, expect } from "vitest";
import { calculateSLADueDate } from "./sla-calculator";

describe("SLA Calculator - Extended Edge Cases", () => {
  // Configuración de jornada: 8:00 AM - 6:00 PM (10 horas/día)

  describe("Year Overlap & Fixed Holidays", () => {
    it("should handle Year Overlap (Dec 31 to Jan 2)", () => {
      // 2024-12-31 (Martes) a las 4:00 PM (16:00)
      // Duración: 4 horas
      const dec31 = new Date("2024-12-31T16:00:00");
      const dueDate = calculateSLADueDate(dec31, 4);

      // Martes 31: 16:00 a 18:00 = 2h consume. Restan 2h.
      // Miércoles 1 de Enero: FESTIVO -> Se salta.
      // Jueves 2 de Enero: 8:00 AM + 2h = 10:00 AM
      expect(dueDate.getFullYear()).toBe(2025);
      expect(dueDate.getMonth()).toBe(0); // Enero
      expect(dueDate.getDate()).toBe(2);
      expect(dueDate.getHours()).toBe(10);
    });
  });

  describe("Easter Week (Semana Santa) 2024", () => {
    // Domingo de Pascua 2024: 31 de Marzo
    // Jueves Santo: 28 de Marzo
    // Viernes Santo: 29 de Marzo

    it("should skip Jueves and Viernes Santo", () => {
      // Miércoles 27 de Marzo, 5:00 PM (17:00)
      // Duración: 2 horas
      const wednesdayEaster = new Date("2024-03-27T17:00:00");
      const dueDate = calculateSLADueDate(wednesdayEaster, 2);

      // Miércoles 27: 17:00 a 18:00 = 1h consume. Resta 1h.
      // Jueves 28: FESTIVO.
      // Viernes 29: FESTIVO.
      // Sábado 30: FIN DE SEMANA.
      // Domingo 31: FIN DE SEMANA.
      // Lunes 1 de Abril: 8:00 AM + 1h = 9:00 AM
      expect(dueDate.getMonth()).toBe(3); // Abril (0-indexed: 3)
      expect(dueDate.getDate()).toBe(1);
      expect(dueDate.getHours()).toBe(9);
    });
  });

  describe("Exact Boundaries", () => {
    it("should handle creation exactly at 18:00 (closing time)", () => {
      const closingTime = new Date("2024-03-20T18:00:00"); // Miércoles
      const dueDate = calculateSLADueDate(closingTime, 1);

      // Al ser exactamente las 18:00, debe saltar a mañana 8:00 AM y sumar 1h -> 9:00 AM
      expect(dueDate.getDate()).toBe(21);
      expect(dueDate.getHours()).toBe(9);
      expect(dueDate.getMinutes()).toBe(0);
    });

    it("should handle creation exactly at 08:00 (opening time)", () => {
      const openingTime = new Date("2024-03-20T08:00:00"); // Miércoles
      const dueDate = calculateSLADueDate(openingTime, 1);

      // 8:00 AM + 1h = 9:00 AM el mismo día
      expect(dueDate.getDate()).toBe(20);
      expect(dueDate.getHours()).toBe(9);
    });

    it("should handle creation 1 minute before closing (17:59)", () => {
      const almostClosed = new Date("2024-03-20T17:59:00");
      const dueDate = calculateSLADueDate(almostClosed, 1); // 60 minutos

      // Consume 1 min hoy. Quedan 59 mins para mañana.
      // Mañana 8:00 AM + 59 mins = 8:59 AM
      expect(dueDate.getDate()).toBe(21);
      expect(dueDate.getHours()).toBe(8);
      expect(dueDate.getMinutes()).toBe(59);
    });
  });

  describe("Long Duration (Multiple Weeks)", () => {
    it("should handle 100 hours SLA (10 days of 10 hours)", () => {
      // Lunes 11 de Marzo 2024, 8:00 AM
      const monday = new Date("2024-03-11T08:00:00");
      const dueDate = calculateSLADueDate(monday, 100);

      // Semana 1: Lunes a Viernes (50 horas). Termina Viernes 6:00 PM.
      // Semana 2: Lunes a Viernes (50 horas). Termina el siguiente Viernes 6:00 PM.
      // Viernes de la semana 2 es 22 de Marzo.
      expect(dueDate.getDate()).toBe(22);
      expect(dueDate.getHours()).toBe(18);
    });
  });
});
