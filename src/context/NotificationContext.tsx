"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Bell } from "lucide-react";

interface NotificationContextType {
  unreadCount: number;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  clearNotifications: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // 1. Get initial user role
    const getRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) setRole(profile.role);
    };
    getRole();
  }, []);

  useEffect(() => {
    // Only Agents/Admins need to know about NEW tickets immediately
    if (role !== "agent" && role !== "admin" && role !== "superadmin") return;

    // Sonido de notificación "Glass" corto en Base64
    const NOTIFICATION_SOUND =
      "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA78AAAAAAAAAABQJAAAAAACAAAJxkQZESQAAAAAAAAAAAAAAAAAAAAAA//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP//uQxAAAAZ8GwAAAAAAAACcAAAAEAAABJAAAAAAAAAAABAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////8LMiaKAAAAABAAAAP";

    // Play sound helper
    const playSound = () => {
      try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.play().catch((e) => console.log("Audio play failed", e));
      } catch {
        // console.error("Audio error", e);
      }
    };

    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        () => {
          setUnreadCount((prev) => prev + 1);
          playSound();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  const clearNotifications = () => {
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, clearNotifications }}>
      {children}
      {/* Visual Toast for new ticket */}
      {unreadCount > 0 && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
          <Bell className="w-5 h-5 animate-pulse" />
          <div>
            <p className="font-bold text-sm">¡Nuevo Ticket Recibido!</p>
            <p className="text-xs text-blue-100">
              {unreadCount} tickets sin leer
            </p>
          </div>
          <button
            onClick={clearNotifications}
            className="ml-2 bg-white/20 hover:bg-white/30 rounded p-1"
          >
            Ver
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
