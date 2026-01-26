"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Reservation } from "../types";

interface UseReservationsProps {
  userId: string;
  startDate: string;
}

export function useReservations({ userId, startDate }: UseReservationsProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentUserVip, setCurrentUserVip] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchReservations = useCallback(async () => {
    const startOfDay = `${startDate}T00:00:00`;
    const endOfDay = `${startDate}T23:59:59`;

    const { data, error } = await supabase
      .from("reservations")
      .select("*, users(full_name, is_vip)")
      .eq("status", "APPROVED")
      .gte("start_time", startOfDay)
      .lte("start_time", endOfDay)
      .order("start_time");

    if (error) {
      console.error("[useReservations] Fetch Error:", error);
      return;
    }
    if (data) setReservations(data as unknown as Reservation[]);
  }, [startDate]);

  const checkVipStatus = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Check both metadata and DB (robust redundancy)
    const isVipMetadata = !!(
      user.user_metadata?.is_vip ||
      user.user_metadata?.role?.toLowerCase() === "vip"
    );
    if (isVipMetadata) {
      setCurrentUserVip(true);
      return;
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("is_vip")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (dbUser) setCurrentUserVip(dbUser.is_vip);
  }, []);

  useEffect(() => {
    fetchReservations();
    checkVipStatus();
  }, [fetchReservations, checkVipStatus]);

  const getAuthToken = async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const cancelReservation = async (reservationId: number) => {
    const authToken = await getAuthToken();
    if (!authToken) throw new Error("No auth token");

    const res = await fetch("/api/reservations/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ reservation_id: reservationId }),
    });

    if (!res.ok) throw new Error("Error cancelling reservation");
    return true;
  };

  const createOrUpdateReservation = async (data: {
    id?: number;
    title: string;
    start_time: string;
    end_time: string;
    user_id: string;
    auditorium_id: string;
    resources: string[];
  }) => {
    const authToken = await getAuthToken();
    if (!authToken) throw new Error("No auth token");

    const apiUrl = data.id
      ? "/api/reservations/update"
      : "/api/reservations/create";
    const method = data.id ? "PUT" : "POST";

    const res = await fetch(apiUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Error saving reservation");
    }
    return await res.json();
  };

  const createSupportTicket = async (data: {
    category: string;
    ticket_type: string;
    description: string;
    user_id: string;
    location: string;
  }) => {
    const authToken = await getAuthToken();
    if (!authToken) throw new Error("No auth token");

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Error creating support ticket");
    return await res.json();
  };

  const updateSupportTicketByDescriptionMatch = async (
    oldDescriptionSubstring: string,
    newDescription: string,
  ) => {
    // 1. Find the ticket
    const { data: tickets, error: searchError } = await supabase
      .from("tickets")
      .select("id")
      .eq("user_id", userId)
      .eq("category", "Reserva Auditorio")
      .ilike("description", `%${oldDescriptionSubstring}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchError) {
      console.error("Error searching ticket:", searchError);
      return;
    }

    if (tickets && tickets.length > 0) {
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ description: newDescription })
        .eq("id", tickets[0].id);

      if (updateError) console.error("Error updating ticket:", updateError);
    }
  };

  return {
    reservations,
    currentUserVip,
    loading,
    setLoading,
    refetch: fetchReservations,
    cancelReservation,
    createOrUpdateReservation,
    createSupportTicket,
    updateSupportTicketByDescriptionMatch,
  };
}
