"use client";

import { useEffect, useRef } from "react";
import { Ticket } from "@/app/admin/types";
import { toast } from "sonner";

interface NotificationManagerProps {
  tickets: Ticket[];
}

// Sonido de notificación "Glass" corto en Base64 para evitar errores 404
const NOTIFICATION_SOUND =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA78AAAAAAAAAABQJAAAAAACAAAJxkQZESQAAAAAAAAAAAAAAAAAAAAAA//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP";

// Tiempo mínimo entre alertas repetidas para el mismo ticket (en milisegundos)
// Ej: 15 minutos = 15 * 60 * 1000
const SNOOZE_TIME_MS = 15 * 60 * 1000;

export default function NotificationManager({
  tickets,
}: NotificationManagerProps) {
  // Mapa en memoria para la sesión actual: TicketID -> Timestamp Última Notificación
  const lastNotificationTime = useRef<Map<number, number>>(new Map());

  // Solicitar permisos al montar
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!tickets.length) return;

    // Helper: Play Sound
    const playSound = () => {
      try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.volume = 0.5;
        audio.play().catch((e) => {
          console.warn("Audio autoplay blocked (interaction needed):", e);
        });
      } catch (e) {
        console.error("Audio error:", e);
      }
    };

    // Helper: Send Notification
    const sendNotification = (
      ticket: Ticket,
      title: string,
      minutes: number,
    ) => {
      // 1. Notificación del Navegador (Sistema)
      if (Notification.permission === "granted") {
        try {
          new Notification(title, {
            body: `#${ticket.ticket_code || ticket.id} lleva ${minutes} mins sin resolver.`,
            icon: "/web-app-manifest-192x192.png", // Usar el icono de la PWA si existe
            tag: `ticket-${ticket.id}`, // Reemplaza notificaciones previas del mismo ticket
            requireInteraction: true, // Se queda hasta que el usuario la cierre
          });
        } catch (e) {
          console.error("System notification error:", e);
        }
      }

      // 2. Notificación In-App (Toast)
      toast.error(`${title}: Ticket #${ticket.id}`, {
        description: `Tiempo excedido: ${minutes} minutos.`,
        duration: 10000,
        action: {
          label: "Ver",
          onClick: () => {
            // Podríamos navegar al ticket, pero este componente es headless por ahora
            // Idealmente usaríamos router para ir al hash o abrir modal
            window.location.hash = `ticket-${ticket.id}`;
          },
        },
      });

      // 3. Sonido
      playSound();
    };

    // Cargar historial de notificaciones recientes del localStorage para persistencia al recargar
    try {
      const saved = localStorage.getItem("notified_tickets_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Limpiar notificaciones muy viejas (> 24 horas) para no saturar memoria
        const now = Date.now();
        Object.entries(parsed).forEach(([id, time]) => {
          if (now - (time as number) < 24 * 60 * 60 * 1000) {
            lastNotificationTime.current.set(Number(id), time as number);
          }
        });
      }
    } catch (e) {
      console.error("Error reading storage:", e);
    }

    const checkSLA = () => {
      const now = Date.now();
      let hasUpdates = false;

      tickets.forEach((ticket) => {
        // Ignorar tickets resueltos, cerrados o pausados
        if (
          ticket.status === "RESUELTO" ||
          ticket.status === "CERRADO" ||
          ticket.status === "EN_ESPERA"
        ) {
          // Si el ticket se resuelva, podríamos limpiar su rastro, pero no es crítico
          return;
        }

        const createdAt = ticket.created_at
          ? new Date(ticket.created_at).getTime()
          : Date.now();
        const diffMinutes = Math.floor((now - createdAt) / (1000 * 60));

        // Umbrales
        const isVIP = ticket.is_vip_ticket;
        const threshold = isVIP ? 30 : 60; // 30 min VIP, 60 min Normal

        if (diffMinutes >= threshold) {
          const lastNotified = lastNotificationTime.current.get(ticket.id) || 0;

          // Si nunca se notificó O ya pasó el tiempo de snooze
          if (now - lastNotified > SNOOZE_TIME_MS) {
            const title = isVIP ? "⚠️ ALERTA SLA VIP" : "⚠️ ALERTA SLA";
            sendNotification(ticket, title, diffMinutes);

            // Actualizar timestamp
            lastNotificationTime.current.set(ticket.id, now);
            hasUpdates = true;
          }
        }
      });

      // Guardar en localStorage si hubo cambios
      if (hasUpdates) {
        try {
          const obj = Object.fromEntries(lastNotificationTime.current);
          localStorage.setItem("notified_tickets_v1", JSON.stringify(obj));
        } catch (e) {
          console.error("Error saving storage:", e);
        }
      }
    };

    // Ejecutar chequeo inicial
    checkSLA();

    // Repetir cada minuto
    const interval = setInterval(checkSLA, 60 * 1000);

    return () => clearInterval(interval);
  }, [tickets]);

  return null;
}
