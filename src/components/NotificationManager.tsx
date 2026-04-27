"use client";

import { useEffect, useRef } from "react";
import { Ticket } from "@/app/admin/admin.types";
import { toast } from "sonner";
import { notificationService } from "@/features/monitoring/services/NotificationService";

interface NotificationManagerProps {
  tickets: Ticket[];
}

// Sonido de notificación "Glass" corto en Base64
const NOTIFICATION_SOUND =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA78AAAAAAAAAABQJAAAAAACAAAJxkQZESQAAAAAAAAAAAAAAAAAAAAAA//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP";

const SNOOZE_TIME_MS = 15 * 60 * 1000;
const IMMINENT_THRESHOLD_MINS = 15; // Alertar 15 min antes de vencer

export default function NotificationManager({
  tickets,
}: NotificationManagerProps) {
  const lastNotificationTime = useRef<Map<number, number>>(new Map());

  // El servicio solicita permisos al instanciarse (ver NotificationService.ts)

  useEffect(() => {
    if (!tickets.length) return;

    const playSound = () => {
      try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch (error) {
        console.error("System notification error:", error);
      }
    };

    const sendNotification = (
      ticket: Ticket,
      title: string,
      message: string,
      isCritical: boolean = false,
    ) => {
      // 1. Notificación del Navegador
      notificationService?.notify(title, {
        body: message,
        tag: `ticket-${ticket.id}`,
        requireInteraction: isCritical,
      });

      // 2. Notificación In-App (Toast)
      if (isCritical) {
        toast.error(`${title}: #${ticket.ticket_code || ticket.id}`, {
          description: message,
          duration: 15000,
          action: {
            label: "Ver",
            onClick: () => {
              window.location.hash = `ticket-${ticket.id}`;
            },
          },
        });
      } else {
        toast.warning(`${title}: #${ticket.ticket_code || ticket.id}`, {
          description: message,
          duration: 8000,
        });
      }

      // 3. Sonido
      playSound();
    };

    // Cargar historial de persistencia
    try {
      const saved = localStorage.getItem("notified_tickets_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        Object.entries(parsed).forEach(([id, time]) => {
          if (now - (time as number) < 24 * 60 * 60 * 1000) {
            lastNotificationTime.current.set(Number(id), time as number);
          }
        });
      }
    } catch {}

    const checkSLA = () => {
      const now = Date.now();
      let hasUpdates = false;

      tickets.forEach((ticket) => {
        // Filtros básicos
        if (
          ticket.status === "RESUELTO" ||
          ticket.status === "CERRADO" ||
          ticket.status === "EN_ESPERA" ||
          ticket.category === "Reserva Auditorio"
        ) {
          return;
        }

        const expectedEnd = ticket.sla_expected_end_at
          ? new Date(ticket.sla_expected_end_at).getTime()
          : null;

        if (!expectedEnd) return;

        const minutesToExpiry = Math.floor((expectedEnd - now) / (1000 * 60));
        const lastNotified = lastNotificationTime.current.get(ticket.id) || 0;

        // CASO 1: Ya vencido (Breached)
        if (minutesToExpiry <= 0) {
          if (now - lastNotified > SNOOZE_TIME_MS) {
            const title = ticket.is_vip_ticket
              ? "🚨 SLA VIP VENCIDO"
              : "🚨 SLA VENCIDO";
            const msg = `El ticket #${ticket.ticket_code || ticket.id} ha superado el tiempo límite.`;
            sendNotification(ticket, title, msg, ticket.is_vip_ticket ?? false);
            lastNotificationTime.current.set(ticket.id, now);
            hasUpdates = true;
          }
        }
        // CASO 2: Vencimiento inminente (Próximos 15 min)
        else if (minutesToExpiry <= IMMINENT_THRESHOLD_MINS) {
          if (now - lastNotified > SNOOZE_TIME_MS * 2) {
            // Menos frecuente para no agobiar
            const title = "⚠️ VENCIMIENTO INMINENTE";
            const msg = `El ticket #${ticket.ticket_code || ticket.id} vencerá en ${minutesToExpiry} minutos.`;
            sendNotification(ticket, title, msg, ticket.is_vip_ticket ?? false);
            lastNotificationTime.current.set(ticket.id, now);
            hasUpdates = true;
          }
        }
      });

      if (hasUpdates) {
        try {
          const obj = Object.fromEntries(lastNotificationTime.current);
          localStorage.setItem("notified_tickets_v2", JSON.stringify(obj));
        } catch {}
      }
    };

    checkSLA();
    const interval = setInterval(checkSLA, 45 * 1000); // Cada 45s
    return () => clearInterval(interval);
  }, [tickets]);

  return null;
}
