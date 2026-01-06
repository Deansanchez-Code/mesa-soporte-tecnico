import {
  addDays,
  getDate,
  getDay,
  getMonth,
  getYear,
  isSameDay,
} from "date-fns";

function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);

  const month0 = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month0, day);
}

function getEmilianiDate(year: number, month0: number, day: number): Date {
  const date = new Date(year, month0, day);
  const dow = getDay(date); // 0=Sun, 1=Mon
  if (dow === 1) return date; // already Monday
  // If moving to next Monday
  // Actually Emiliani law says: if it falls on Mon, stays. If not, moves to next Mon.
  // Wait, some are fixed. Emiliani applies to specific ones.
  // The function moves it to next Monday relative to the original date.
  const daysUntiNextMonday = (8 - dow) % 7;
  // if dow=0(Sun), need 1 day -> Mon. (8-0)%7 = 1. Correct.
  // if dow=2(Tue), need 6 days. (8-2)%7 = 6. Correct.
  // if dow=1(Mon), (8-1)%7 = 0. Correct.
  if (daysUntiNextMonday === 0) return date;
  return addDays(date, daysUntiNextMonday);
}

export function getColombianHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // 1. Fixed Holidays (Unless they fall on weekend? No, Fixed means Fixed in date, but paid.
  // Wait, in Colombia some are "Fixed" (Immune to Emiliani) and some Move.

  // Fixed:
  holidays.push(new Date(year, 0, 1)); // 1 Jan
  holidays.push(new Date(year, 4, 1)); // 1 May
  holidays.push(new Date(year, 6, 20)); // 20 Jul
  holidays.push(new Date(year, 7, 7)); // 7 Aug
  holidays.push(new Date(year, 11, 8)); // 8 Dec
  holidays.push(new Date(year, 11, 25)); // 25 Dec

  // 2. Emiliani Law (Moved to next Monday)
  // 6 Jan (Reyes)
  holidays.push(getEmilianiDate(year, 0, 6));
  // 19 Mar (San Jose)
  holidays.push(getEmilianiDate(year, 2, 19));
  // 29 Jun (San Pedro y San Pablo)
  holidays.push(getEmilianiDate(year, 5, 29));
  // 15 Aug (Asuncion)
  holidays.push(getEmilianiDate(year, 7, 15));
  // 12 Oct (Raza)
  holidays.push(getEmilianiDate(year, 9, 12));
  // 1 Nov (Todos Santos)
  holidays.push(getEmilianiDate(year, 10, 1));
  // 11 Nov (Cartagena)
  holidays.push(getEmilianiDate(year, 10, 11));

  // 3. Easter Related
  const easter = getEaster(year);

  // Jueves Santo (Fixed relative to Easter)
  holidays.push(addDays(easter, -3));
  // Viernes Santo (Fixed relative to Easter)
  holidays.push(addDays(easter, -2));

  // Emiliani Easter Related (Ascension, Corpus, Sagrado Corazon)
  // Ascension: Easter + 39 days? Actually 40 days after Easter Sunday. Ideally always Monday?
  // Traditionally Thursday (40 days), moved to Monday (+43 days from Sunday)
  holidays.push(
    getEmilianiDate(
      year,
      getMonth(addDays(easter, 39)),
      getDate(addDays(easter, 39)),
    ),
  ); // Ascension (Thu -> Mon)
  // Wait, simpler: it's always observed on the Monday.
  // Ascension is 43 days after Easter (Sunday) in Colombia practice?
  // Let's stick to: Original Date -> Emiliani.
  // Ascension is 39 days after Easter (Thursday).
  // Corpus Christi is 60 days after Easter (Thursday).
  // Sagrado Corazon is 68 days after Easter (Friday).

  // Correction:
  // Ascensión del Señor: 43 días después de Domingo de Pascua (Lunes)
  // Corpus Christi: 64 días después de Domingo de Pascua (Lunes)
  // Sagrado Corazón: 71 días después de Domingo de Pascua (Lunes)
  // Using direct addition for the observed Monday

  holidays.push(addDays(easter, 43));
  holidays.push(addDays(easter, 64));
  holidays.push(addDays(easter, 71));

  return holidays;
}

export function isColombianHoliday(date: Date): boolean {
  const year = getYear(date);
  const holidays = getColombianHolidays(year);
  return holidays.some((h) => isSameDay(h, date));
}
