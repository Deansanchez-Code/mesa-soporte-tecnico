import {
  addMinutes,
  isWeekend,
  setHours,
  setMinutes,
  addDays,
  startOfDay,
} from "date-fns";
import { Ticket } from "@/app/admin/admin.types";

// Configuración por defecto: Lunes a Viernes, 8:00 AM - 6:00 PM
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

/**
 * Calcula la fecha de vencimiento basada en una duración en horas,
 * respetando el horario laboral (saltando noches y fines de semana).
 * @param startDate Fecha de inicio (usualmente created_at)
 * @param hoursDuration Duración del SLA en horas
 * @returns Date Fecha de vencimiento estimada
 */
export const calculateSLADueDate = (
  startDate: Date | string,
  hoursDuration: number,
): Date => {
  let currentDate = new Date(startDate);
  let minutesRemaining = hoursDuration * 60;

  // Normalizar fecha de inicio si está fuera de horario laboral
  currentDate = adjustToBusinessHours(currentDate);

  while (minutesRemaining > 0) {
    const currentBusinessEnd = setMinutes(
      setHours(new Date(currentDate), BUSINESS_HOURS.end),
      0,
    );

    // Calcular minutos restantes en el día actual
    const diffMs = currentBusinessEnd.getTime() - currentDate.getTime();
    const minutesAvailableToday = Math.floor(diffMs / 1000 / 60);

    if (minutesAvailableToday >= minutesRemaining) {
      // Si alcanza el tiempo hoy, simplemente sumamos
      return addMinutes(currentDate, minutesRemaining);
    } else {
      // Si no alcanza, consumimos lo que queda del día y avanzamos al siguiente día laboral
      minutesRemaining -= minutesAvailableToday;
      currentDate = getNextBusinessStart(currentDate);
    }
  }

  return currentDate;
};

/**
 * Ajusta una fecha para que caiga dentro del horario laboral.
 * - Si es fin de semana -> Lunes a primera hora.
 * - Si es antes de las 8 AM -> Hoy a las 8 AM.
 * - Si es después de las 6 PM -> Mañana a las 8 AM.
 */
function adjustToBusinessHours(date: Date): Date {
  let d = new Date(date);

  // 1. Si es fin de semana, mover al lunes siguiente a las 8 AM
  while (isWeekend(d)) {
    d = addDays(d, 1);
    d = startOfDay(d);
    d = setHours(d, BUSINESS_HOURS.start);
  }

  const hour = d.getHours();

  // 2. Si es antes de la hora de inicio (8 AM), setear a las 8 AM
  if (hour < BUSINESS_HOURS.start) {
    d = setHours(d, BUSINESS_HOURS.start);
    d = setMinutes(d, 0);
  }
  // 3. Si es después de la hora de fin (6 PM), pasar al día siguiente a las 8 AM
  else if (hour >= BUSINESS_HOURS.end) {
    d = addDays(d, 1);
    d = setHours(d, BUSINESS_HOURS.start);
    d = setMinutes(d, 0);
    // Recursión por si el día siguiente es fin de semana
    return adjustToBusinessHours(d);
  }

  return d;
}

/**
 * Obtiene el inicio del siguiente día laboral (ej. Mañana a las 8 AM).
 */
function getNextBusinessStart(date: Date): Date {
  let d = addDays(date, 1);
  d = setHours(d, BUSINESS_HOURS.start);
  d = setMinutes(d, 0);
  return adjustToBusinessHours(d); // Maneja fines de semana automáticamente
}
