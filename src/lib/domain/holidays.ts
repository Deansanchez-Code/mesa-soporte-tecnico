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

export function getColombiaLocalDateString(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getEmilianiDateString(
  year: number,
  month0: number,
  day: number,
): string {
  const date = new Date(year, month0, day);
  const dow = date.getDay(); // 0 = Sun, 1 = Mon
  const fmt = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  if (dow === 1) return fmt(year, month0, day);
  const daysUntilNextMonday = (8 - dow) % 7;
  const emilianiDate = new Date(
    date.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000,
  );
  return fmt(
    emilianiDate.getFullYear(),
    emilianiDate.getMonth(),
    emilianiDate.getDate(),
  );
}

export function getColombianHolidaysStrings(year: number): string[] {
  const holidays: string[] = [];

  const fmt = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  // 1. Fixed Holidays
  holidays.push(fmt(year, 0, 1)); // 1 Jan
  holidays.push(fmt(year, 4, 1)); // 1 May
  holidays.push(fmt(year, 6, 20)); // 20 Jul
  holidays.push(fmt(year, 7, 7)); // 7 Aug
  holidays.push(fmt(year, 11, 8)); // 8 Dec
  holidays.push(fmt(year, 11, 25)); // 25 Dec

  // 2. Emiliani Law (Moved to next Monday)
  holidays.push(getEmilianiDateString(year, 0, 6)); // 6 Jan
  holidays.push(getEmilianiDateString(year, 2, 19)); // 19 Mar
  holidays.push(getEmilianiDateString(year, 5, 29)); // 29 Jun
  holidays.push(getEmilianiDateString(year, 7, 15)); // 15 Aug
  holidays.push(getEmilianiDateString(year, 9, 12)); // 12 Oct
  holidays.push(getEmilianiDateString(year, 10, 1)); // 1 Nov
  holidays.push(getEmilianiDateString(year, 10, 11)); // 11 Nov

  // 3. Easter Related
  const easter = getEaster(year);

  // Jueves Santo
  const holyThursday = new Date(easter.getTime() - 3 * 24 * 60 * 60 * 1000);
  holidays.push(
    fmt(
      holyThursday.getFullYear(),
      holyThursday.getMonth(),
      holyThursday.getDate(),
    ),
  );

  // Viernes Santo
  const holyFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  holidays.push(
    fmt(holyFriday.getFullYear(), holyFriday.getMonth(), holyFriday.getDate()),
  );

  // Emiliani Easter Related (Ascension, Corpus, Sagrado Corazon)
  const ascension = new Date(easter.getTime() + 43 * 24 * 60 * 60 * 1000);
  holidays.push(
    fmt(ascension.getFullYear(), ascension.getMonth(), ascension.getDate()),
  );

  const corpus = new Date(easter.getTime() + 64 * 24 * 60 * 60 * 1000);
  holidays.push(fmt(corpus.getFullYear(), corpus.getMonth(), corpus.getDate()));

  const sagrado = new Date(easter.getTime() + 71 * 24 * 60 * 60 * 1000);
  holidays.push(
    fmt(sagrado.getFullYear(), sagrado.getMonth(), sagrado.getDate()),
  );

  return holidays;
}

export function isColombianHoliday(date: Date): boolean {
  const colDateStr = getColombiaLocalDateString(date);
  const year = parseInt(colDateStr.split("-")[0], 10);
  const holidays = getColombianHolidaysStrings(year);
  return holidays.includes(colDateStr);
}
