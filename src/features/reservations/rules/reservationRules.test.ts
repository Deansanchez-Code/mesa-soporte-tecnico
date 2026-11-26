import { describe, it, expect } from "vitest";
import {
  getVisibleSpaceIdsForUser,
  canAccessNextVigencia,
  isDateBeyondCurrentVigencia,
  hasCrossSpaceOverlap,
} from "./reservationRules";

describe("reservationRules", () => {
  describe("getVisibleSpaceIdsForUser", () => {
    it("limita a Auditorio 103 (1), Biblioteca (3) y Ambiente 107 (4) para instructores y planta sin VIP", () => {
      expect(
        getVisibleSpaceIdsForUser({
          role: "user",
          employment_type: "contratista",
          job_category: "instructor",
          is_vip: false,
        }),
      ).toEqual(["1", "3", "4"]);

      expect(
        getVisibleSpaceIdsForUser({
          role: "user",
          employment_type: "planta",
          job_category: "funcionario",
          is_vip: false,
        }),
      ).toEqual(["1", "3", "4"]);
    });

    it("habilita todos los 5 ambientes para VIP, Coordinadores, Admin y Superadmin", () => {
      expect(
        getVisibleSpaceIdsForUser({
          role: "user",
          employment_type: "contratista",
          is_vip: true,
        }),
      ).toEqual(["1", "2", "3", "4", "5"]);

      expect(
        getVisibleSpaceIdsForUser({
          role: "coordinator",
          employment_type: "planta",
        }),
      ).toEqual(["1", "2", "3", "4", "5"]);

      expect(getVisibleSpaceIdsForUser({ role: "superadmin" })).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
      ]);
    });
  });

  describe("canAccessNextVigencia & isDateBeyondCurrentVigencia", () => {
    it("bloquea la próxima vigencia para instructores/contratistas sin VIP", () => {
      expect(
        canAccessNextVigencia({
          role: "user",
          employment_type: "contratista",
          job_category: "instructor",
          is_vip: false,
        }),
      ).toBe(false);
    });

    it("permite acceso a próxima vigencia a funcionarios de planta y VIP", () => {
      expect(
        canAccessNextVigencia({
          role: "user",
          employment_type: "planta",
          is_vip: false,
        }),
      ).toBe(true);

      expect(
        canAccessNextVigencia({
          role: "user",
          employment_type: "contratista",
          is_vip: true,
        }),
      ).toBe(true);
    });

    it("detecta fechas posteriores al 31 de diciembre del año en curso", () => {
      const refNow = new Date("2026-11-25T15:00:00-05:00");
      expect(isDateBeyondCurrentVigencia("2026-12-31", refNow)).toBe(false);
      expect(isDateBeyondCurrentVigencia("2027-01-01", refNow)).toBe(true);
    });
  });

  describe("hasCrossSpaceOverlap", () => {
    const existing = [
      {
        id: 10,
        auditorium_id: "1",
        start_time: "2026-11-28T10:00:00-05:00",
        end_time: "2026-11-28T12:00:00-05:00",
        status: "APPROVED",
      },
      {
        id: 11,
        auditorium_id: "3",
        start_time: "2026-11-28T14:00:00-05:00",
        end_time: "2026-11-28T16:00:00-05:00",
        status: "CANCELLED",
      },
    ];

    it("detecta solapamiento en un ambiente diferente para el mismo solicitante", () => {
      const conflict = hasCrossSpaceOverlap(
        existing,
        "4",
        "2026-11-28T11:00:00-05:00",
        "2026-11-28T13:00:00-05:00",
      );
      expect(conflict?.id).toBe(10);
    });

    it("ignora el mismo ambiente, reservas canceladas o la reserva editada", () => {
      expect(
        hasCrossSpaceOverlap(
          existing,
          "1",
          "2026-11-28T11:00:00-05:00",
          "2026-11-28T13:00:00-05:00",
        ),
      ).toBeNull();

      expect(
        hasCrossSpaceOverlap(
          existing,
          "4",
          "2026-11-28T14:30:00-05:00",
          "2026-11-28T15:30:00-05:00",
        ),
      ).toBeNull();

      expect(
        hasCrossSpaceOverlap(
          existing,
          "4",
          "2026-11-28T11:00:00-05:00",
          "2026-11-28T13:00:00-05:00",
          10,
        ),
      ).toBeNull();
    });
  });
});
