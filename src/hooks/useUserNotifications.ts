"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
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
        toast.info(data[0].title, {
          description: data[0].message,
          duration: 10000,
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
          toast.error("⚠️ Alerta de Prioridad", {
            description: newNotif.message,
            duration: 0, // Manual close
          });
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
