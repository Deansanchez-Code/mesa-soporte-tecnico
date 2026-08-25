import { Ticket } from "@/app/admin/admin.types";
import { isColombianHoliday } from "./holidays";

// Configuración por defecto: Lunes a Viernes, 8:00 AM - 6:00 PM (Hora de Colombia / UTC-5)
const BUSINESS_HOURS = {
  start: 8, // 8 AM
  end: 18, // 6 PM
};

/**
 * Determina las horas de SLA según el tipo de ticket.
 * - VIP: 4 horas
 * - Incidente (INC): 8 horas
 * - Requerimiento (REQ): 24 horas
 */
export const getSLAHours = (ticket: Ticket): number => {
  if (ticket.is_vip_ticket) return 4;
  if (ticket.ticket_type === "INC") return 8;
  return 24; // Default REQ
};

// Funciones auxiliares para trabajar en la zona horaria virtual de Colombia (UTC-5)
function toColombiaVirtual(date: Date | string): Date {
  const d = new Date(date);
  return new Date(d.getTime() - 5 * 60 * 60 * 1000);
}

function fromColombiaVirtual(d: Date): Date {
  return new Date(d.getTime() + 5 * 60 * 60 * 1000);
}

function isWeekendUTC(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

function isHolidayUTC(d: Date): boolean {
  const realDate = fromColombiaVirtual(d);
  return isColombianHoliday(realDate);
}

function adjustToBusinessHoursUTC(d: Date): Date {
  // 1. Si es fin de semana o festivo, mover al siguiente día hábil a las 8 AM
  while (isWeekendUTC(d) || isHolidayUTC(d)) {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(BUSINESS_HOURS.start, 0, 0, 0);
  }

  const hour = d.getUTCHours();

  // 2. Si es antes de las 8 AM, setear a las 8 AM del mismo día
  if (hour < BUSINESS_HOURS.start) {
    d.setUTCHours(BUSINESS_HOURS.start, 0, 0, 0);
  }
  // 3. Si es después de las 6 PM, pasar al día siguiente a las 8 AM
  else if (hour >= BUSINESS_HOURS.end) {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(BUSINESS_HOURS.start, 0, 0, 0);
    // Recursión por si el día siguiente es fin de semana o festivo
    return adjustToBusinessHoursUTC(d);
  }

  return d;
}

/**
 * Calcula la fecha de vencimiento basada en una duración en horas,
 * respetando el horario laboral de Colombia (saltando noches, fines de semana y festivos).
 * @param startDate Fecha de inicio (usualmente created_at)
 * @param hoursDuration Duración del SLA en horas
 * @returns Date Fecha de vencimiento estimada
 */
export const calculateSLADueDate = (
  startDate: Date | string,
  hoursDuration: number,
): Date => {
  let virtualDate = toColombiaVirtual(startDate);
  let minutesRemaining = hoursDuration * 60;

  // Ajustar la fecha virtual al horario laboral
  virtualDate = adjustToBusinessHoursUTC(virtualDate);

  while (minutesRemaining > 0) {
    // Definir el fin de la jornada laboral de hoy en la fecha virtual
    const currentBusinessEnd = new Date(virtualDate);
    currentBusinessEnd.setUTCHours(BUSINESS_HOURS.end, 0, 0, 0);

    // Calcular minutos disponibles hoy
    const diffMs = currentBusinessEnd.getTime() - virtualDate.getTime();
    const minutesAvailableToday = Math.floor(diffMs / 1000 / 60);

    if (minutesAvailableToday >= minutesRemaining) {
      // Si alcanza el tiempo hoy, sumamos y salimos
      virtualDate = new Date(
        virtualDate.getTime() + minutesRemaining * 60 * 1000,
      );
      break;
    } else {
      // Consumimos lo que queda de hoy y pasamos al siguiente día laboral a las 8 AM
      minutesRemaining -= minutesAvailableToday;
      virtualDate.setUTCDate(virtualDate.getUTCDate() + 1);
      virtualDate.setUTCHours(BUSINESS_HOURS.start, 0, 0, 0);
      virtualDate = adjustToBusinessHoursUTC(virtualDate);
    }
  }

  // Convertimos la fecha virtual de vuelta a la fecha real UTC
  return fromColombiaVirtual(virtualDate);
};

/**
 * Calcula los minutos laborables reales transcurridos entre dos fechas en el huso de Colombia (UTC-5).
 * @param startDate Fecha de inicio
 * @param endDate Fecha de fin
 * @returns number Minutos laborables transcurridos
 */
export const calculateBusinessMinutesBetween = (
  startDate: Date | string,
  endDate: Date | string,
): number => {
  let start = toColombiaVirtual(startDate);
  const end = toColombiaVirtual(endDate);

  if (start >= end) return 0;

  let totalMinutes = 0;

  // Ajustar la fecha de inicio si cae fuera de horario laboral o en fin de semana/festivo
  start = adjustToBusinessHoursUTC(new Date(start));

  while (start < end) {
    const currentBusinessEnd = new Date(start);
    currentBusinessEnd.setUTCHours(BUSINESS_HOURS.end, 0, 0, 0);

    if (end <= currentBusinessEnd) {
      if (end > start) {
        totalMinutes += Math.floor(
          (end.getTime() - start.getTime()) / 1000 / 60,
        );
      }
      break;
    } else {
      if (currentBusinessEnd > start) {
        totalMinutes += Math.floor(
          (currentBusinessEnd.getTime() - start.getTime()) / 1000 / 60,
        );
      }
      start.setUTCDate(start.getUTCDate() + 1);
      start.setUTCHours(BUSINESS_HOURS.start, 0, 0, 0);
      start = adjustToBusinessHoursUTC(start);
    }
  }

  return totalMinutes;
};
