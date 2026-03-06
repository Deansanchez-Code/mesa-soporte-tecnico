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
        setNotifications(data);
        // Show initial toast for the most recent one
        data.forEach((notif) => {
          const titleLower = notif.title.toLowerCase();
          if (titleLower.includes("cancelada")) {
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
          } else if (titleLower.includes("modificaci")) {
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
