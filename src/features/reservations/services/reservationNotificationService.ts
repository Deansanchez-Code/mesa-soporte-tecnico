import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { EmailService } from "@/lib/email/email-service";
import ReservationReminder from "@/lib/email/templates/ReservationReminder";
import { isColombianHoliday } from "@/lib/domain/holidays";
import {
  isWeekend,
  subDays,
  startOfDay,
  addMinutes,
  isAfter,
  isBefore,
} from "date-fns";
import { Database } from "@/app/admin/types";
import { SupabaseClient } from "@supabase/supabase-js";

function hasValidDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  const trimmed = desc.trim();
  if (trimmed.length === 0) return false;
  // Normalize by removing common punctuation and extra spaces, then lowercase
  const normalized = trimmed
    .toLowerCase()
    .replace(/[.,\-_/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const blacklist = [
    "ninguno",
    "ninguna",
    "no",
    "na",
    "no aplica",
    "sin requerimientos",
    "ningun",
    "0",
    "ningunos",
    "ningunas",
    "nada",
    "sin novedad",
  ];
  return !blacklist.includes(normalized) && normalized.length > 0;
}

function resolveReservationUserEmail(
  user:
    | {
        email?: string | null;
        username?: string | null;
        employment_type?: string | null;
        job_category?: string | null;
      }
    | null
    | undefined,
): string {
  if (!user) return "";
  const empType = (user.employment_type || "").toLowerCase();
  const jobCat = (user.job_category || "").toLowerCase();
  const isOfficial =
    empType.includes("planta") ||
    empType.includes("funcionario") ||
    empType.includes("oficial") ||
    jobCat.includes("coordinador");

  const rawEmail = (user.email || "").trim().toLowerCase();
  const cleanUser = (user.username || "").trim().toLowerCase();

  if (isOfficial && cleanUser) {
    return `${cleanUser}@sena.edu.co`;
  }
  if (
    rawEmail &&
    rawEmail.includes("@") &&
    !rawEmail.endsWith("@sistema.local")
  ) {
    return rawEmail;
  }
  if (cleanUser) {
    return `${cleanUser}@sena.edu.co`;
  }
  return "";
}

function getSpaceDisplayName(auditoriumId?: string | number | null): string {
  const id = String(auditoriumId || "1");
  if (id === "2") return "Subdirección";
  if (id === "3") return "Biblioteca";
  if (id === "4") return "Ambiente 107";
  if (id === "5") return "Ambiente de Cocina";
  return "Auditorio Principal";
}

type ReservationWithUser =
  Database["public"]["Tables"]["reservations"]["Row"] & {
    users: Database["public"]["Tables"]["users"]["Row"] | null;
  };

export class ReservationNotificationService {
  /**
   * Procesa todas las notificaciones pendientes de reservas.
   * Utiliza getSupabaseAdmin() para garantizar lectura/escritura consistente en audit_logs sin bloqueo por RLS.
   */
  static async processNotifications() {
    console.log("🔔 Iniciando procesamiento de notificaciones de reserva...");
    const supabase = getSupabaseAdmin() as unknown as SupabaseClient<Database>;
    const now = new Date();

    // 1. Obtener reservas aprobadas futuras (o recientes para el recordatorio de 15 min)
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select(
        `
        *,
        users!reservations_user_id_fkey (
          *
        )
      `,
      )
      .eq("status", "APPROVED")
      .gt("start_time", subDays(now, 1).toISOString());

    if (error) {
      console.error("Error al obtener reservas para notificaciones:", error);
      return { success: false, error };
    }

    if (!reservations || reservations.length === 0) {
      return { success: true, processed: 0 };
    }

    let notifiedCount = 0;

    for (const res of reservations as unknown as ReservationWithUser[]) {
      try {
        const startTime = new Date(res.start_time);

        // --- LÓGICA 1 DÍA ANTES ---
        await this.handleOneDayReminder(res, startTime, now, supabase);

        // --- LÓGICA 15 MINUTOS ANTES ---
        const sent15min = await this.handleFifteenMinReminder(
          res,
          startTime,
          now,
          supabase,
        );

        if (sent15min) notifiedCount++;
      } catch (err) {
        console.error(`Error procesando reserva #${res.id}:`, err);
      }
    }

    return { success: true, processed: notifiedCount };
  }

  /**
   * Maneja el recordatorio de 1 día antes.
   */
  private static async handleOneDayReminder(
    res: ReservationWithUser,
    startTime: Date,
    now: Date,
    supabase: SupabaseClient<Database>,
  ) {
    // Si hoy es fin de semana o festivo, no enviamos correos
    const isTodayHolidayOrWeekend = isWeekend(now) || isColombianHoliday(now);
    if (isTodayHolidayOrWeekend) return;

    // Determinar si hoy es el día de aviso para este evento
    const isAvisoHoy = this.isTodayTheNotificationDay(startTime, now);

    if (isAvisoHoy) {
      const alreadyNotified = await this.checkAlreadyNotified(
        res.id,
        "ONE_DAY_REMINDER",
        supabase,
      );
      if (!alreadyNotified) {
        await this.sendReminderEmail(res, "ONE_DAY");
        await this.logNotification(res.id, "ONE_DAY_REMINDER", supabase);
      }
    }
  }

  /**
   * Determina si hoy es el día correcto para enviar el recordatorio de "1 día antes"
   * teniendo en cuenta fines de semana y festivos.
   */
  private static isTodayTheNotificationDay(
    eventDate: Date,
    today: Date,
  ): boolean {
    const eventStartOfDay = startOfDay(eventDate);
    const todayStartOfDay = startOfDay(today);

    // Si el evento es hoy, y ayer no fue hábil, hoy es el día de aviso (lo antes posible)
    if (eventStartOfDay.getTime() === todayStartOfDay.getTime()) {
      const yesterday = subDays(today, 1);
      if (isWeekend(yesterday) || isColombianHoliday(yesterday)) {
        return true;
      }
      return false;
    }

    // Lógica retrospectiva: Buscar el primer día hábil antes del evento
    let checkDay = subDays(eventStartOfDay, 1);
    while (isWeekend(checkDay) || isColombianHoliday(checkDay)) {
      checkDay = subDays(checkDay, 1);
    }

    // Si el primer día hábil antes del evento es HOY, entonces notificamos.
    return startOfDay(checkDay).getTime() === todayStartOfDay.getTime();
  }

  /**
   * Maneja el recordatorio de 15 minutos antes.
   */
  private static async handleFifteenMinReminder(
    res: ReservationWithUser,
    startTime: Date,
    now: Date,
    supabase: SupabaseClient<Database>,
  ): Promise<boolean> {
    const fifteenMinBefore = addMinutes(startTime, -15);
    const fiveMinAfterStart = addMinutes(startTime, 5);

    if (isAfter(now, fifteenMinBefore) && isBefore(now, fiveMinAfterStart)) {
      const alreadyNotified = await this.checkAlreadyNotified(
        res.id,
        "FIFTEEN_MIN_REMINDER",
        supabase,
      );
      if (!alreadyNotified) {
        await this.sendReminderEmail(res, "FIFTEEN_MIN");
        await this.logNotification(res.id, "FIFTEEN_MIN_REMINDER", supabase);
        return true;
      }
    }
    return false;
  }

  /**
   * Verifica en audit_logs si ya se envió esta notificación específica.
   */
  private static async checkAlreadyNotified(
    resId: number,
    action: string,
    supabase: SupabaseClient<Database>,
  ): Promise<boolean> {
    const { data } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("resource_id", resId.toString())
      .eq("action", action)
      .limit(1);

    return !!data && data.length > 0;
  }

  /**
   * Registra el envío en audit_logs.
   */
  private static async logNotification(
    resId: number,
    action: string,
    supabase: SupabaseClient<Database>,
  ) {
    await supabase.from("audit_logs").insert([
      {
        action,
        resource: "RESERVATION_SYSTEM",
        resource_id: resId.toString(),
        details: { sent_at: new Date().toISOString() },
      },
    ]);
  }

  /**
   * Envía el correo electrónico con los datos de la reserva únicamente al funcionario/instructor titular.
   */
  private static async sendReminderEmail(
    res: ReservationWithUser,
    type: "ONE_DAY" | "FIFTEEN_MIN",
  ) {
    const user = res.users;
    if (!user) return;

    // Evitar enviar correos de recordatorio al SuperAdmin (dasanchezh) por reservas de prueba o editadas administrativamente
    const cleanUsername = (user.username || "").trim().toLowerCase();
    const cleanRole = (user.role || "").trim().toLowerCase();
    if (cleanUsername === "dasanchezh" || cleanRole === "superadmin") {
      return;
    }

    const recipientEmail = resolveReservationUserEmail(
      user as {
        email?: string | null;
        username?: string | null;
        employment_type?: string | null;
        job_category?: string | null;
      },
    );

    if (!recipientEmail || !recipientEmail.includes("@")) return;

    const startDate = new Date(res.start_time);
    const endDate = new Date(res.end_time);
    const dateStr = startDate.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Bogota",
    });
    const timeStr = `${startDate.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Bogota",
    })} - ${endDate.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Bogota",
    })}`;

    const recipients = [recipientEmail];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const description = (res as any).description;
    const hasSpecialRequirements = hasValidDescription(description);

    // Si hay requerimientos especiales, enviar copia a soporte/logística
    if (hasSpecialRequirements && String(res.auditorium_id) !== "3") {
      recipients.push("jeavendano@sena.edu.co");
    }

    const spaceName = getSpaceDisplayName(res.auditorium_id);

    await EmailService.send({
      to: recipients,
      subject:
        type === "ONE_DAY"
          ? `Recordatorio: Tu evento "${res.title}" (${spaceName}) es mañana`
          : `Recordatorio: Tu evento "${res.title}" (${spaceName}) comienza en 15 minutos`,
      react: ReservationReminder({
        userName: user.full_name,
        eventTitle: res.title,
        date: dateStr,
        timeRange: timeStr,
        location: spaceName,
        resources: res.resources || [],
        specialRequirements: description,
        reminderType: type,
      }),
    });
  }
}
