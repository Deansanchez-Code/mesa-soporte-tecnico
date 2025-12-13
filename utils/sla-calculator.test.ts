import { describe, it, expect } from "vitest";
import { getSLAHours, calculateSLADueDate } from "./sla-calculator";
import { Ticket } from "@/app/admin/types";

describe("SLA Calculator", () => {
  describe("getSLAHours", () => {
    it("should return 4 hours for VIP tickets", () => {
      const ticket = { is_vip_ticket: true, ticket_type: "REQ" } as Ticket;
      expect(getSLAHours(ticket)).toBe(4);
    });

    it("should return 8 hours for Incident tickets (non-VIP)", () => {
      const ticket = { is_vip_ticket: false, ticket_type: "INC" } as Ticket;
      expect(getSLAHours(ticket)).toBe(8);
    });

    it("should return 24 hours for Requirement tickets (non-VIP)", () => {
      const ticket = { is_vip_ticket: false, ticket_type: "REQ" } as Ticket;
      expect(getSLAHours(ticket)).toBe(24);
    });
  });

  describe("calculateSLADueDate", () => {
    // Helper to create date: Year, Month (0-11), Day, Hour, Minute
    const createDate = (d: number, h: number, m: number = 0) =>
      new Date(2023, 9, d, h, m); // Oct 2023. Oct 2, 2023 is Monday.

    it("should calculate due date correctly within the same day", () => {
      // Monday 9 AM + 2 hours -> Monday 11 AM
      const start = createDate(2, 9); // Oct 2 (Mon)
      const due = calculateSLADueDate(start, 2);
      expect(due.getDate()).toBe(2);
      expect(due.getHours()).toBe(11);
    });

    it("should roll over to next day if duration exceeds business hours", () => {
      // Monday 4 PM (16:00) + 4 hours -> Ends 18:00 (2h consumed), 2h left -> Tuesday 10:00 (8+2)
      const start = createDate(2, 16);
      const due = calculateSLADueDate(start, 4);
      expect(due.getDate()).toBe(3); // Tuesday Oct 3
      expect(due.getHours()).toBe(10);
    });

    it("should roll over weekend (Friday to Monday)", () => {
      // Friday Oct 6, 4 PM (16:00) + 4 hours -> Ends 18:00 (2h consumed), 2h left -> Monday Oct 9, 10:00
      const start = createDate(6, 16); // Oct 6 is Friday
      const due = calculateSLADueDate(start, 4);
      expect(due.getDate()).toBe(9); // Monday Oct 9
      expect(due.getHours()).toBe(10);
    });

    it("should adjust start time if before business hours", () => {
      // Monday 7 AM + 1 hour -> Counts start at 8 AM -> 9 AM
      const start = createDate(2, 7);
      const due = calculateSLADueDate(start, 1);
      expect(due.getDate()).toBe(2);
      expect(due.getHours()).toBe(9);
    });

    it("should adjust start time if after business hours", () => {
      // Monday 8 PM (20:00) + 1 hour -> Starts Tuesday 8 AM -> Tuesday 9 AM
      const start = createDate(2, 20);
      const due = calculateSLADueDate(start, 1);
      expect(due.getDate()).toBe(3);
      expect(due.getHours()).toBe(9);
    });

    it("should handle multi-day duration", () => {
      // Monday 9 AM + 24 hours (SLA)
      // Mon: 9-18 (9h)
      // Tue: 8-18 (10h) -> Total 19h
      // Wed: 8-13 (5h) -> Total 24h
      const start = createDate(2, 9);
      const due = calculateSLADueDate(start, 24);
      expect(due.getDate()).toBe(4); // Wednesday Oct 4
      expect(due.getHours()).toBe(13); // 1 PM
    });
  });
});
