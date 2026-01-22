"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { toast } from "sonner";
import { formatDateForDB } from "@/lib/scheduling";
import { TimeBlock } from "@/lib/scheduling";

import { Assignment } from "../types";

interface UseAssignmentsProps {
  areaId: number;
  areaName: string;
  fetchStart: Date;
  fetchEnd: Date;
}

export function useAssignments({
  areaId,
  areaName,
  fetchStart,
  fetchEnd,
}: UseAssignmentsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);

  const startStr = formatDateForDB(fetchStart);
  const endStr = formatDateForDB(fetchEnd);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Fetch Assignments (Flat)
      const { data: assignData, error: assignError } = await supabase
        .from("instructor_assignments")
        .select("id, instructor_id, assignment_date, time_block")
        .eq("area_id", areaId)
        .gte("assignment_date", startStr)
        .lte("assignment_date", endStr);
      // ... lines 41-114 ... (skipping some for brevity in TargetContent but they must match)
      if (assignError) throw assignError;

      const instructorIds = Array.from(
        new Set(assignData?.map((a) => a.instructor_id) || []),
      );

      let combined: Assignment[] = [];

      if (instructorIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", instructorIds);

        if (userError) throw userError;

        const userMap = new Map(
          userData?.map((u) => [u.id, u.full_name]) || [],
        );

        combined = (assignData || []).map((a) => ({
          ...a,
          instructor: {
            full_name: userMap.get(a.instructor_id) || "Desconocido",
          },
        }));
      }

      // 3. Fetch Reservations if it's the Auditorium
      if (areaName.toUpperCase().includes("AUDITORIO")) {
        const { data: resData, error: resError } = await supabase
          .from("reservations")
          .select(
            "id, title, start_time, end_time, resources, user_id, status, users(full_name, is_vip)",
          )
          .eq("status", "APPROVED")
          .gte("start_time", startStr + "T00:00:00")
          .lte("start_time", endStr + "T23:59:59");

        if (resError) throw resError;

        if (resData && resData.length > 0) {
          const reservationAssignments: Assignment[] = (
            resData as unknown as (Assignment & {
              users: { full_name: string; is_vip: boolean };
            })[]
          ).map((r) => {
            const localDateObj = new Date(r.start_time!);
            const rawDate = formatDateForDB(localDateObj);

            const startHour = localDateObj.getHours();
            let block: TimeBlock = "MANANA";
            if (startHour >= 12 && startHour < 18) block = "TARDE";
            if (startHour >= 18) block = "NOCHE";

            return {
              id: r.id,
              instructor_id: "RESERVA",
              assignment_date: rawDate,
              time_block: block,
              instructor: {
                full_name: r.users?.full_name || "RESERVA",
              },
              is_reservation: true,
              title: r.title,
              start_time: r.start_time,
              end_time: r.end_time,
              resources: r.resources,
              status: r.status,
              users: r.users || undefined,
              user_id: r.user_id,
            };
          });
          combined = [...combined, ...reservationAssignments];
        }
      }

      setAssignments(combined);
    } catch (error: unknown) {
      console.error("[useAssignments] Fetch Error:", error);
      toast.error("Error al cargar asignaciones");
    } finally {
      setLoading(false);
    }
  }, [areaId, areaName, startStr, endStr]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const deleteAssignment = useCallback(
    async (id: number, isReservation: boolean, deletedByName?: string) => {
      try {
        if (isReservation) {
          // Use the API for reservations to ensure server-side auth/VIP checks
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const authToken = session?.access_token;

          if (!authToken) throw new Error("No hay sesión activa");

          const res = await fetch("/api/reservations/cancel", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ reservation_id: id }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Error al cancelar la reserva");
          }

          toast.success(
            `Reserva eliminada correctamente${deletedByName ? ` por ${deletedByName}` : ""}`,
          );
        } else {
          // Instructor assignments can still be handled client-side if RLS allows,
          // or we could add an API for them too. For now, keep original logic.
          const { error } = await supabase
            .from("instructor_assignments")
            .delete()
            .eq("id", id);
          if (error) throw error;
          toast.success(
            `Asignación eliminada correctamente${deletedByName ? ` por ${deletedByName}` : ""}`,
          );
        }
        await fetchAssignments();
        return { success: true };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";
        console.error("Delete Error:", error);
        toast.error("Error al eliminar: " + message);
        return { success: false, error: message };
      }
    },
    [fetchAssignments],
  );

  return {
    assignments,
    loading,
    refetch: fetchAssignments,
    deleteAssignment,
  };
}
