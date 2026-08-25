"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Reservation } from "@/features/reservations/types";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";

export interface UpcomingAlertData {
  reservation: Reservation;
  minutesRemaining: number;
  spaceName: string;
}

export function useUpcomingReservationAlert(
  userProfile: UserProfile["profile"],
) {
  const [upcomingAlert, setUpcomingAlert] = useState<UpcomingAlertData | null>(
    null,
  );
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const checkUpcomingReservations = useCallback(async () => {
    if (!userProfile?.id) return;

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    ).toISOString();

    const { data: userPublic } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", userProfile.id)
      .maybeSingle();

    const dbUserId = userPublic?.id || userProfile.id;

    const { data, error } = await supabase
      .from("reservations")
      .select("*, users(full_name, is_vip, role)")
      .eq("user_id", dbUserId)
      .in("status", ["APPROVED", "PENDING"])
      .gte("start_time", startOfToday)
      .lte("start_time", endOfToday)
      .order("start_time", { ascending: true });

    if (error || !data || data.length === 0) {
      return;
    }

    const currentMs = now.getTime();

    for (const res of data as unknown as Reservation[]) {
      if (dismissedIds.has(res.id)) continue;

      const startTimeMs = new Date(res.start_time).getTime();
      const diffMs = startTimeMs - currentMs;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      // Ventana de alerta: entre 1 y 10 minutos previos
      if (diffMinutes >= 1 && diffMinutes <= 10) {
        const getSpaceName = (auditoriumId?: string) => {
          if (auditoriumId === "1") return "Auditorio Principal";
          if (auditoriumId === "3") return "Biblioteca";
          if (auditoriumId === "2") return "Subdirección";
          return "Espacio Reservado";
        };

        setUpcomingAlert({
          reservation: res,
          minutesRemaining: diffMinutes,
          spaceName: getSpaceName(res.auditorium_id),
        });
        break;
      }
    }
  }, [userProfile, dismissedIds]);

  useEffect(() => {
    let isMounted = true;
    const runCheck = async () => {
      if (isMounted) {
        await checkUpcomingReservations();
      }
    };
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [checkUpcomingReservations]);

  const dismissAlert = (reservationId: number) => {
    setDismissedIds((prev) => new Set(prev).add(reservationId));
    setUpcomingAlert(null);
  };

  return {
    upcomingAlert,
    dismissAlert,
    refetchCheck: checkUpcomingReservations,
  };
}
