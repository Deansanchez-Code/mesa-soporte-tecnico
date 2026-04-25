import { describe, it, expect } from "vitest";
import { calculateSLADueDate, getSLAHours } from "./sla-calculator";
import { Ticket } from "@/app/admin/admin.types";

describe("SLA Calculator", () => {
  const mockTicket = (overrides: Partial<Ticket> = {}): Ticket =>
    ({
      id: "test-id",
      is_vip_ticket: false,
      ticket_type: "REQ",
      created_at: new Date().toISOString(),
      ...overrides,
    }) as Ticket;

  describe("getSLAHours", () => {
    it("should return 4 hours for VIP tickets", () => {
      const ticket = mockTicket({ is_vip_ticket: true });
      expect(getSLAHours(ticket)).toBe(4);
    });

    it("should return 8 hours for Incidents (INC)", () => {
      const ticket = mockTicket({ ticket_type: "INC" });
      expect(getSLAHours(ticket)).toBe(8);
    });

    it("should return 24 hours for Requests (REQ) by default", () => {
      const ticket = mockTicket({ ticket_type: "REQ" });
      expect(getSLAHours(ticket)).toBe(24);
    });
  });

  describe("calculateSLADueDate", () => {
    // Escenario: Miércoles 10:00 AM (Día laboral, dentro de horario)
    const midWeekMorning = new Date("2024-03-20T10:00:00"); // Miércoles

    it("should calculate simple 4h SLA within the same business day", () => {
      const dueDate = calculateSLADueDate(midWeekMorning, 4);
      // 10:00 AM + 4h = 2:00 PM (14:00)
      expect(dueDate.getHours()).toBe(14);
      expect(dueDate.getDate()).toBe(20);
    });

    it("should carry over to next day if SLA exceeds business hours (8h from 2 PM)", () => {
      const midWeekAfternoon = new Date("2024-03-20T14:00:00"); // 2:00 PM
      const dueDate = calculateSLADueDate(midWeekAfternoon, 8);

      // Horas disponibles hoy: 14:00 a 18:00 = 4h
      // Restan 4h para mañana.
      // Mañana a las 8:00 AM + 4h = 12:00 PM
      expect(dueDate.getDate()).toBe(21); // Jueves
      expect(dueDate.getHours()).toBe(12);
    });

    it("should skip weekends and holidays", () => {
      const fridayLate = new Date("2024-03-22T16:00:00"); // Viernes 4:00 PM
      const dueDate = calculateSLADueDate(fridayLate, 4);

      // Viernes 22: 16:00 a 18:00 = 2h consume. Restan 2h.
      // Sábado 23 y Domingo 24 se saltan.
      // Lunes 25 es FESTIVO (San José) -> Se salta.
      // Martes 26 a las 8:00 AM + 2h = 10:00 AM
      expect(dueDate.getDate()).toBe(26); // Martes
      expect(dueDate.getHours()).toBe(10);
    });

    it("should start from next business day if created on weekend", () => {
      const sunday = new Date("2024-03-24T12:00:00"); // Domingo
      const dueDate = calculateSLADueDate(sunday, 4);

      // Se ajusta a Martes 26 8:00 AM (ya que el lunes 25 es festivo) + 4h = 12:00 PM
      expect(dueDate.getDate()).toBe(26); // Martes
      expect(dueDate.getHours()).toBe(12);
    });

    it("should start from next business day if created after hours (8 PM)", () => {
      const lateNight = new Date("2024-03-20T20:00:00"); // Miércoles 8:00 PM
      const dueDate = calculateSLADueDate(lateNight, 4);

      // Se ajusta a Jueves 8:00 AM + 4h = 12:00 PM
      expect(dueDate.getDate()).toBe(21); // Jueves
      expect(dueDate.getHours()).toBe(12);
    });

    it("should skip Colombian holidays (e.g., Monday March 25, 2024)", () => {
      // Viernes 22 de Marzo, 4:00 PM
      const fridayLate = new Date("2024-03-22T16:00:00");
      const dueDate = calculateSLADueDate(fridayLate, 4);

      // Viernes: 16:00 a 18:00 = 2h consume. Restan 2h.
      // Sábado 23, Domingo 24 se saltan.
      // Lunes 25 es Festivo (San José) -> Se salta.
      // Martes 26 a las 8:00 AM + 2h = 10:00 AM
      expect(dueDate.getDate()).toBe(26); // Martes
      expect(dueDate.getHours()).toBe(10);
    });

    it("should handle ticket created at the very last minute of business day (5:59 PM)", () => {
      const lastMinute = new Date("2024-03-20T17:59:00"); // Miércoles 5:59 PM
      const dueDate = calculateSLADueDate(lastMinute, 1); // 1h SLA

      // 5:59 PM tiene solo 1 min hoy. Restan 59 mins.
      // Mañana 8:00 AM + 59 mins = 8:59 AM
      expect(dueDate.getDate()).toBe(21); // Jueves
      expect(dueDate.getHours()).toBe(8);
      expect(dueDate.getMinutes()).toBe(59);
    });

    it("should handle long duration SLAs spanning multiple weeks (40h duration)", () => {
      const mondayStart = new Date("2024-03-18T08:00:00"); // Lunes 8:00 AM
      const dueDate = calculateSLADueDate(mondayStart, 40); // 40h (exactamente una semana laboral de 5 días x 8h? No, jornada es 10h)

      // Jornada: 8 AM a 6 PM = 10 horas.
      // 40h / 10h/día = 4 días exactos.
      // Lunes -> Martes -> Miércoles -> Jueves.
      // Debe vencer el Viernes a las 8:00 AM?
      // Lunes 8 AM a 6 PM (10h)
      // Martes 8 AM a 6 PM (10h)
      // Miércoles 8 AM a 6 PM (10h)
      // Jueves 8 AM a 6 PM (10h)
      // Total 40h consumidas el Jueves a las 6:00 PM.
      expect(dueDate.getDate()).toBe(21); // Jueves
      expect(dueDate.getHours()).toBe(18);
    });
  });
});
