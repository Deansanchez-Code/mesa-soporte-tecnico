import { createClient } from "@/lib/supabase/servidor";
import { EmailService } from "@/lib/email/email-service";
import ReservationReminder from "@/lib/email/templates/ReservationReminder";
import { isColombianHoliday } from "@/lib/domain/holidays";
import {
  isWeekend,
  subDays,
  format,
  startOfDay,
  addMinutes,
  isAfter,
  isBefore,
} from "date-fns";
import { es } from "date-fns/locale";
import { Database } from "@/app/admin/types";
import { SupabaseClient } from "@supabase/supabase-js";

type ReservationWithUser =
  Database["public"]["Tables"]["reservations"]["Row"] & {
    users: Database["public"]["Tables"]["users"]["Row"] | null;
  };

export class ReservationNotificationService {
  /**
   * Procesa todas las notificaciones pendientes de reservas.
   */
  static async processNotifications() {
    console.log("🔔 Iniciando procesamiento de notificaciones de reserva...");
    const supabase = await createClient();
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
   * Envía el correo electrónico con los datos de la reserva.
   */
  private static async sendReminderEmail(
    res: ReservationWithUser,
    type: "ONE_DAY" | "FIFTEEN_MIN",
  ) {
    const user = res.users;
    if (!user) return;

    const employmentType = (user.employment_type || "").toLowerCase();
    const isOfficial =
      employmentType.includes("planta") ||
      employmentType.includes("funcionario") ||
      employmentType.includes("oficial");

    let recipientEmail = user.email;
    if (isOfficial && user.username) {
      recipientEmail = `${user.username.trim()}@sena.edu.co`.toLowerCase();
    }

    if (!recipientEmail || !recipientEmail.includes("@")) return;

    const startDate = new Date(res.start_time);
    const endDate = new Date(res.end_time);
    const dateStr = format(startDate, "EEEE, d 'de' MMMM 'de' yyyy", {
      locale: es,
    });
    const timeStr = `${format(startDate, "hh:mm a")} - ${format(endDate, "hh:mm a")}`;

    const recipients = [recipientEmail];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const description = (res as any).description;
    const hasSpecialRequirements = description && description.trim().length > 0;

    // Si hay requerimientos especiales, enviar copia a coordinación
    if (hasSpecialRequirements) {
      recipients.push("jeavendano@sena.edu.co");
    }

    await EmailService.send({
      to: recipients,
      subject:
        type === "ONE_DAY"
          ? `Recordatorio: Tu evento "${res.title}" es mañana`
          : `Recordatorio: Tu evento "${res.title}" comienza en 15 minutos`,
      react: ReservationReminder({
        userName: user.full_name,
        eventTitle: res.title,
        date: dateStr,
        timeRange: timeStr,
        location: "Auditorio Principal",
        resources: res.resources || [],
        specialRequirements: description,
        reminderType: type,
      }),
    });
  }
}
