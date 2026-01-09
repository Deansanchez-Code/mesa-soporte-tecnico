"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { toast } from "sonner";
import { useUserProfile } from "./useUserProfile";

// Configuración Hardcoded (Mover a Env o DB en futuro)
const SENA_NETWORKS = ["181.129.1.5", "181.129.1.6"]; // Ejemplo IPs SENA
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutos
const LUNCH_BREAK_START = "12:00";

interface SessionState {
  isActive: boolean;
  sessionId: number | null;
  shiftStatus: "normal" | "overtime" | "lunch" | "closed";
  publicIp: string | null;
  isSenaNetwork: boolean;
}

export function useSessionMonitor() {
  const { user, role, loading } = useUserProfile();
  const [session, setSession] = useState<SessionState>({
    isActive: false,
    sessionId: null,
    shiftStatus: "normal",
    publicIp: null,
    isSenaNetwork: false,
  });

  const [showLunchModal, setShowLunchModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);

  // 1. Detectar IP y Network al iniciar
  useEffect(() => {
    const checkNetwork = async () => {
      // Si está cargando o no es agente, no hacemos nada
      if (loading) return;
      if (role !== "agent") return;

      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        const ip = data.ip;

        // Simulación: Si estamos en localhost, asumimos red segura para desarrollo
        const isSena =
          typeof window !== "undefined" &&
          window.location.hostname === "localhost"
            ? true
            : SENA_NETWORKS.includes(ip);

        setSession((prev) => ({
          ...prev,
          publicIp: ip,
          isSenaNetwork: isSena,
        }));

        if (!isSena) {
          toast.warning("Conexión Externa Detectada", {
            description:
              "Para registrar asistencia válida, conéctese a la red SENA.",
            duration: 10000,
          });
        }
      } catch (e) {
        console.error("Error fetching IP:", e);
      }
    };

    checkNetwork();
  }, [loading, role]);

  // 2. Heartbeat & Session Management
  const sendHeartbeat = useCallback(async () => {
    if (!user || !session.sessionId) return;

    try {
      const { error } = await supabase
        .from("work_sessions")
        .update({
          session_end: new Date().toISOString(),
          // Aqui podriamos actualizar otros estados si cambiaran
        })
        .eq("id", session.sessionId);

      if (error) console.error("Heartbeat error:", error);
    } catch (e) {
      console.error("Heartbeat fail:", e);
    }
  }, [user, session.sessionId]);

  // Iniciar Sesión en BD
  const startSession = useCallback(async () => {
    // Validación de rol estricta
    if (loading || role !== "agent") return;
    if (!user || session.isActive) return;

    // Verificar limite de sesiones (Max 3)
    // NOTE: Deshabilitado temporalmente para pruebas. En producción debe habilitarse.
    const SESSION_LIMIT_ENABLED = false;

    if (SESSION_LIMIT_ENABLED) {
      const { count } = await supabase
        .from("work_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("session_end", null);

      if (count && count >= 3) {
        toast.error("Límite de Sesiones Excedido", {
          description: "Cierre sesiones en otros dispositivos para continuar.",
        });
        return;
      }
    }

    // Identificar user agent
    const ua = navigator.userAgent;

    const { data, error } = await supabase
      .from("work_sessions")
      .insert({
        user_id: user.id,
        session_start: new Date().toISOString(),
        ip_address: session.publicIp,
        user_agent: ua,
      })
      .select()
      .single();

    if (data && !error) {
      setSession((prev) => ({ ...prev, isActive: true, sessionId: data.id }));
      toast.success("Turno Iniciado", {
        description: "Asistencia registrada correctamente.",
      });
    }
  }, [user, session.isActive, session.publicIp, role, loading]);

  // Intervalo de Heartbeat
  useEffect(() => {
    if (session.isActive) {
      const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [session.isActive, sendHeartbeat]);

  // 3. Reglas de Horario (Office Lunch & Shift End)
  useEffect(() => {
    if (!session.isActive) return;

    const checkTimeRules = () => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      // Almuerzo (Solo oficina standard por ahora - mejorar con weekly_schedule)
      if (timeStr === LUNCH_BREAK_START && !showLunchModal) {
        setShowLunchModal(true);
      }
    };

    const timer = setInterval(checkTimeRules, 60 * 1000); // Chequear cada minuto
    return () => clearInterval(timer);
  }, [session.isActive, showLunchModal]);

  return {
    session,
    startSession,
    showLunchModal,
    setShowLunchModal,
    showOvertimeModal,
    setShowOvertimeModal,
  };
}
