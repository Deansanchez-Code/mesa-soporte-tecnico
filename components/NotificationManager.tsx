"use client";

import { useEffect, useRef } from "react";
import { Ticket } from "@/app/admin/types";

interface NotificationManagerProps {
  tickets: Ticket[];
}

export default function NotificationManager({
  tickets,
}: NotificationManagerProps) {
  // Use ref to keep track of notified tickets to avoid spamming
  const notifiedTickets = useRef<Set<number>>(new Set());

  // Request permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!tickets.length) return;

    const triggerNotification = (
      ticket: Ticket,
      title: string,
      minutes: number
    ) => {
      // Visual Notification
      try {
        new Notification(title, {
          body: `#${
            ticket.ticket_code || ticket.id
          } lleva ${minutes} mins sin resolver.`,
          icon: "/vercel.svg", // Fallback icon
          tag: `ticket-${ticket.id}`, // Prevent stacking
        });

        // Sound
        const audio = new Audio("/notification.mp3"); // Ensure this file exists or use a default
        audio.play().catch((e) => console.log("Audio play failed", e));
      } catch (e) {
        console.error("Notification error:", e);
      }
    };

    const checkSLA = () => {
      if (Notification.permission !== "granted") return;

      const now = new Date().getTime();

      tickets.forEach((ticket) => {
        // Only check active tickets
        if (
          ticket.status === "RESUELTO" ||
          ticket.status === "CERRADO" ||
          ticket.status === "EN_ESPERA" // Paused tickets don't alert
        ) {
          return;
        }

        const createdAt = new Date(ticket.created_at).getTime();
        const diffMinutes = (now - createdAt) / (1000 * 60);

        // Define Thresholds
        // VIP: 30 minutes
        // Normal: 60 minutes
        const isVIP = ticket.is_vip_ticket;
        const threshold = isVIP ? 30 : 60;
        const alertLabel = isVIP ? "⚠️ Ticket VIP" : "Ticket Pendiente";

        if (diffMinutes >= threshold) {
          // Check if already notified recently (or at all for this breach)
          // For simplicity, we notify once per session/load or we could use a timestamp map
          if (!notifiedTickets.current.has(ticket.id)) {
            triggerNotification(ticket, alertLabel, Math.floor(diffMinutes));
            notifiedTickets.current.add(ticket.id);
          }
        }
      });
    };

    // Check immediately and then every minute
    checkSLA();
    const interval = setInterval(checkSLA, 60000);

    return () => clearInterval(interval);
  }, [tickets]);

  return null; // Headless component
}
