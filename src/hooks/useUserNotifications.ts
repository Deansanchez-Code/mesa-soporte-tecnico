"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

/**
 * Verifica si el mensaje de notificación contiene una fecha que ya pasó (comparado con el inicio del día actual)
 * o si la notificación fue creada en una fecha anterior a hoy.
 */
function isNotificationExpired(notif: UserNotification): boolean {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  // 1. Intentar extraer fecha explícita DD/MM/YYYY o DD-MM-YYYY en el mensaje
  const dmyMatch = (notif.message || "").match(
    /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/,
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const eventDay = new Date(year, month, day);
    if (eventDay < startOfToday) {
      return true;
    }
  }

  // 2. Intentar extraer fecha en español ej. "15 de mayo de 2026"
  const monthsEs: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };
  const spanishDateMatch = (notif.message || "")
    .toLowerCase()
    .match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/i);
  if (spanishDateMatch) {
    const day = parseInt(spanishDateMatch[1], 10);
    const monthName = spanishDateMatch[2].toLowerCase();
    const year = spanishDateMatch[3]
      ? parseInt(spanishDateMatch[3], 10)
      : now.getFullYear();
    if (monthsEs[monthName] !== undefined) {
      const eventDay = new Date(year, monthsEs[monthName], day);
      if (eventDay < startOfToday) {
        return true;
      }
    }
  }

  // 3. Si no tiene fecha futura identificable y fue creada antes de hoy, expirar para no repetir mensajes viejos
  if (notif.created_at) {
    const createdDate = new Date(notif.created_at);
    if (createdDate < startOfToday) {
      return true;
    }
  }

  return false;
}

export function useUserNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const typedData = data as UserNotification[];
        const allIds = typedData.map((n) => n.id);

        // Marcar como leídas inmediatamente para que no vuelvan a aparecer en recargas o fechas posteriores
        await supabase
          .from("user_notifications")
          .update({ read: true })
          .in("id", allIds);

        // Filtrar notificaciones cuya fecha ya haya pasado
        const validNotifs = typedData.filter(
          (notif) => !isNotificationExpired(notif),
        );

        if (validNotifs.length > 0) {
          setNotifications(validNotifs);
          validNotifs.forEach((notif) => {
            const titleLower = notif.title.toLowerCase();
            if (
              titleLower.includes("cancelada") ||
              titleLower.includes("no confirmada")
            ) {
              toast.error(notif.title, {
                description: notif.message,
                duration: 8000,
              });
            } else if (
              titleLower.includes("aprobada") ||
              titleLower.includes("confirmada")
            ) {
              toast.success(notif.title, {
                description: notif.message,
                duration: 8000,
              });
            } else if (
              titleLower.includes("modificaci") ||
              titleLower.includes("ajuste")
            ) {
              toast.warning(notif.title, {
                description: notif.message,
                duration: 8000,
              });
            } else {
              toast.info(notif.title, {
                description: notif.message,
                duration: 8000,
              });
            }
          });
        }
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("user_notifications_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as UserNotification;
          // Marcar como leída tras recibirse en tiempo real
          supabase
            .from("user_notifications")
            .update({ read: true })
            .eq("id", newNotif.id)
            .then(() => {});

          if (isNotificationExpired(newNotif)) return;

          setNotifications((prev) => [newNotif, ...prev]);

          const titleLower = newNotif.title.toLowerCase();
          if (titleLower.includes("cancelada")) {
            toast.error(newNotif.title, {
              description: newNotif.message,
              duration: 0,
            });
          } else if (
            titleLower.includes("aprobada") ||
            titleLower.includes("confirmada")
          ) {
            toast.success(newNotif.title, {
              description: newNotif.message,
              duration: 10000,
            });
          } else if (titleLower.includes("modificaci")) {
            toast.warning(newNotif.title, {
              description: newNotif.message,
              duration: 0,
            });
          } else {
            toast.info(newNotif.title, {
              description: newNotif.message,
              duration: 10000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return { notifications, markAsRead };
}
