import { addDays, format, startOfDay } from "date-fns";

export const COLOMBIAN_HOLIDAYS_2025 = [
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-03-24", // San José
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-06-02", // Ascensión
  "2025-06-23", // Corpus Christi
  "2025-06-30", // San Pedro y San Pablo
  "2025-07-20", // Independencia
  "2025-08-07", // Batalla de Boyacá
  "2025-08-18", // Asunción
  "2025-10-13", // Raza
  "2025-11-03", // Todos los Santos
  "2025-11-17", // Indep. Cartagena
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
];

export const DATE_FORMAT = "yyyy-MM-dd";

export function displayDate(date: Date): string {
  return format(date, "EEEE d 'de' MMMM", {
    // Basic formatting if locale not provided, or better to use locale from date-fns/locale in param
  });
}

export const COLOMBIAN_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-01-12",
  "2026-03-23",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-18",
  "2026-06-08",
  "2026-06-15",
  "2026-06-29",
  "2026-07-20",
  "2026-08-07",
  "2026-08-17",
  "2026-10-12",
  "2026-11-02",
  "2026-11-16",
  "2026-12-08",
  "2026-12-25",
];

export const ALL_HOLIDAYS = [
  ...COLOMBIAN_HOLIDAYS_2025,
  ...COLOMBIAN_HOLIDAYS_2026,
];

export type TimeBlock = "MANANA" | "TARDE" | "NOCHE";

export const TIME_BLOCKS: Record<
  TimeBlock,
  { label: string; range: string; startHour: number; endHour: number }
> = {
  MANANA: {
    label: "Mañana",
    range: "06:00 - 12:00",
    startHour: 6,
    endHour: 11,
  }, // Ends at 11:59:59 internally
  TARDE: { label: "Tarde", range: "12:00 - 18:00", startHour: 12, endHour: 17 },
  NOCHE: { label: "Noche", range: "18:30 - 22:30", startHour: 18, endHour: 22 },
};

export function isHoliday(date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  return ALL_HOLIDAYS.includes(dateStr);
}

/**
 * Generates dates between start and end (inclusive) that match the given days of week.
 * daysOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export function getRecurrentDates(
  startDate: Date,
  endDate: Date,
  daysOfWeek: number[], // 0-6
): Date[] {
  const dates: Date[] = [];
  let current = startOfDay(startDate);
  const end = startOfDay(endDate);

  const daysSet = new Set(daysOfWeek);

  while (current <= end) {
    if (daysSet.has(current.getDay())) {
      dates.push(new Date(current));
    }
    current = addDays(current, 1);
  }

  return dates;
}

export function formatDateForDB(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
