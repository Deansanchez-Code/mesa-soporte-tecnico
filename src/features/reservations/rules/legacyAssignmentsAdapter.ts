import { TIME_BLOCKS, TimeBlock } from "@/lib/scheduling";
import { Reservation } from "../types";

export interface LegacyAssignmentRow {
  id: number | string;
  area_id: number;
  instructor_id: string;
  assignment_date: string;
  time_block?: string | null;
  instructorName?: string | null;
}

/**
 * Mapea el nombre de un área en `public.areas` al ID de ambiente especial en `reservations`.
 * Retorna null si es un aula convencional no gestionada en la matriz de 5 espacios.
 */
export function mapAreaNameToSpaceId(areaName?: string | null): string | null {
  if (!areaName) return null;
  const upper = areaName.trim().toUpperCase();
  if (upper.includes("AUDITORIO")) return "1";
  if (upper.includes("SUBDIRECC")) return "2";
  if (upper.includes("BIBLIOTECA")) return "3";
  if (upper.includes("107")) return "4";
  if (upper.includes("COCINA")) return "5";
  return null;
}

export function getTimeBlockBounds(
  assignmentDate: string,
  timeBlock?: string | null,
): { startIso: string; endIso: string; label: string } {
  const normalizedBlock = (timeBlock || "MANANA").trim().toUpperCase();
  const blockKey: TimeBlock =
    normalizedBlock === "TARDE"
      ? "TARDE"
      : normalizedBlock === "NOCHE"
        ? "NOCHE"
        : "MANANA";
  const blockInfo = TIME_BLOCKS[blockKey];
  const [rawStart, rawEnd] = blockInfo.range.split(" - ");
  const startHhMm = (rawStart || "06:00").trim();
  const endHhMm = (rawEnd || "12:00").trim();

  return {
    startIso: `${assignmentDate}T${startHhMm}:00-05:00`,
    endIso: `${assignmentDate}T${endHhMm}:00-05:00`,
    label: blockInfo.label,
  };
}

export function mapLegacyAssignmentToReservation(
  row: LegacyAssignmentRow,
  areaName?: string | null,
): Reservation | null {
  const spaceId = mapAreaNameToSpaceId(areaName);
  if (!spaceId) return null;

  const { startIso, endIso, label } = getTimeBlockBounds(
    row.assignment_date,
    row.time_block,
  );
  const numericId = Number(row.id);

  return {
    id: Number.isFinite(numericId) ? -Math.abs(numericId) : -1,
    auditorium_id: spaceId,
    title: `Asignación de Formación (${label})`,
    start_time: startIso,
    end_time: endIso,
    status: "APPROVED",
    user_id: row.instructor_id,
    resources: [],
    users: {
      full_name: row.instructorName?.trim() || "Instructor",
      is_vip: false,
      role: "instructor",
    },
  };
}

/**
 * Fusiona reservas de `reservations` con asignaciones heredadas de `instructor_assignments`,
 * deduplicando registros ya migrados (mismo espacio, inicio y fin) y ordenando cronológicamente.
 */
export function mergeReservationsWithLegacy<
  T extends {
    auditorium_id?: string | number | null;
    start_time: string;
    end_time: string;
  },
>(reservations: T[], legacyItems: T[]): T[] {
  const existingKeys = new Set(
    reservations.map((r) => {
      const space = String(r.auditorium_id || "1");
      const sMs = new Date(r.start_time).getTime();
      const eMs = new Date(r.end_time).getTime();
      return `${space}|${sMs}|${eMs}`;
    }),
  );

  const uniqueLegacy = legacyItems.filter((item) => {
    const space = String(item.auditorium_id || "1");
    const sMs = new Date(item.start_time).getTime();
    const eMs = new Date(item.end_time).getTime();
    return !existingKeys.has(`${space}|${sMs}|${eMs}`);
  });

  return [...reservations, ...uniqueLegacy].sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
}
