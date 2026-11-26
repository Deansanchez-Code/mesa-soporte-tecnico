import { describe, it, expect } from "vitest";
import {
  getTimeBlockBounds,
  mapAreaNameToSpaceId,
  mapLegacyAssignmentToReservation,
  mergeReservationsWithLegacy,
} from "./legacyAssignmentsAdapter";

describe("legacyAssignmentsAdapter", () => {
  it("mapea correctamente nombres de áreas especiales a IDs de espacios y omite aulas regulares", () => {
    expect(mapAreaNameToSpaceId("AUDITORIO 103")).toBe("1");
    expect(mapAreaNameToSpaceId("SUBDIRECCIÓN")).toBe("2");
    expect(mapAreaNameToSpaceId("Subdireccion")).toBe("2");
    expect(mapAreaNameToSpaceId("BIBLIOTECA CADPH")).toBe("3");
    expect(mapAreaNameToSpaceId("AMBIENTE 107")).toBe("4");
    expect(mapAreaNameToSpaceId("Ambiente de Cocina")).toBe("5");
    expect(mapAreaNameToSpaceId("AMBIENTE 204")).toBeNull();
  });

  it("convierte bloques MANANA, TARDE y NOCHE a timestamps con zona horaria -05:00", () => {
    expect(getTimeBlockBounds("2026-12-02", "MANANA")).toEqual({
      startIso: "2026-12-02T06:00:00-05:00",
      endIso: "2026-12-02T12:00:00-05:00",
      label: "Mañana",
    });

    expect(getTimeBlockBounds("2026-12-02", "TARDE")).toEqual({
      startIso: "2026-12-02T12:00:00-05:00",
      endIso: "2026-12-02T18:00:00-05:00",
      label: "Tarde",
    });

    expect(getTimeBlockBounds("2026-12-02", "NOCHE")).toEqual({
      startIso: "2026-12-02T18:30:00-05:00",
      endIso: "2026-12-02T22:30:00-05:00",
      label: "Noche",
    });
  });

  it("mapea asignaciones reales de Ambiente 107 (2026-12-02) a objetos compatibles con el calendario", () => {
    const mapped = mapLegacyAssignmentToReservation(
      {
        id: 31,
        area_id: 30,
        instructor_id: "user-nury",
        assignment_date: "2026-12-02",
        time_block: "MANANA",
        instructorName: "Nury Mindrey Barrera",
      },
      "AMBIENTE 107",
    );

    expect(mapped).toMatchObject({
      id: -31,
      auditorium_id: "4",
      title: "Asignación de Formación (Mañana)",
      start_time: "2026-12-02T06:00:00-05:00",
      end_time: "2026-12-02T12:00:00-05:00",
      status: "APPROVED",
      users: { full_name: "Nury Mindrey Barrera" },
    });
  });

  it("fusiona reservas y asignaciones legacy deduplicando tras migración y ordenando por inicio", () => {
    const native = [
      {
        id: 500,
        auditorium_id: "4",
        start_time: "2026-12-02T06:00:00-05:00",
        end_time: "2026-12-02T12:00:00-05:00",
        title: "Migrada",
      },
    ];
    const legacy = [
      {
        id: -31,
        auditorium_id: "4",
        start_time: "2026-12-02T06:00:00-05:00",
        end_time: "2026-12-02T12:00:00-05:00",
        title: "Duplicada",
      },
      {
        id: -32,
        auditorium_id: "4",
        start_time: "2026-12-02T12:00:00-05:00",
        end_time: "2026-12-02T18:00:00-05:00",
        title: "Asignación Tarde",
      },
    ];

    const merged = mergeReservationsWithLegacy(native, legacy);
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.id)).toEqual([500, -32]);
  });
});
