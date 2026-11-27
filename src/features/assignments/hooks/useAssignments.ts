"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDateForDB, TimeBlock } from "@/lib/scheduling";

import { Assignment } from "../types";
import { cancelReservationAction } from "@/features/reservations/actions/reservationActions";
import { deleteInstructorAssignmentAction } from "@/features/reservations/actions/assignmentAdminActions";
import {
  getTimeBlockBounds,
  mapAreaNameToSpaceId,
  mergeReservationsWithLegacy,
} from "@/features/reservations/rules/legacyAssignmentsAdapter";

interface UseAssignmentsProps {
  areaId: number;
  areaName: string;
  fetchStart: Date;
  fetchEnd: Date;
}

type TimedAssignment = Assignment & {
  start_time: string;
  end_time: string;
};

interface RawReservationUser {
  full_name: string;
  is_vip: boolean;
}

interface RawReservationRow {
  id: number;
  title?: string | null;
  description?: string | null;
  auditorium_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  resources?: string[] | null;
  user_id?: string | null;
  status?: "APPROVED" | "CANCELLED" | "PENDING" | null;
  users?: RawReservationUser | RawReservationUser[] | null;
}

const bogotaDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

function getBogotaDateAndBlock(
  isoDate?: string | null,
): { dateStr: string; block: TimeBlock } | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = bogotaDateTimeFormatter.formatToParts(parsed);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";

  const dateStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const rawHour = Number.parseInt(getPart("hour"), 10);
  const startHour = rawHour === 24 ? 0 : rawHour;

  let block: TimeBlock = "MANANA";
  if (startHour >= 12 && startHour < 18) block = "TARDE";
  if (startHour >= 18) block = "NOCHE";

  return { dateStr, block };
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

      if (assignError) throw assignError;

      const instructorIds = Array.from(
        new Set(assignData?.map((a) => a.instructor_id) || []),
      );

      let combined: TimedAssignment[] = [];

      if (instructorIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", instructorIds);

        if (userError) throw userError;

        const userMap = new Map(
          userData?.map((u) => [u.id, u.full_name]) || [],
        );

        combined = (assignData || []).map((a) => {
          const { startIso, endIso, label } = getTimeBlockBounds(
            a.assignment_date,
            a.time_block,
          );

          return {
            ...a,
            user_id: a.instructor_id,
            title: a.time_block
              ? `Asignación de Formación (${label})`
              : "Asignación de Formación",
            start_time: startIso,
            end_time: endIso,
            instructor: {
              full_name: userMap.get(a.instructor_id) || "Desconocido",
            },
          };
        });
      }

      // 3. Fetch Reservations if it's a Special Area (Auditorio, Subdirección, Biblioteca, Ambiente 107 o Cocina)
      const targetAuditoriumId = mapAreaNameToSpaceId(areaName);

      if (targetAuditoriumId) {
        const { data: resData, error: resError } = await supabase
          .from("reservations")
          .select(
            "id, title, description, auditorium_id, start_time, end_time, resources, user_id, status, users(full_name, is_vip)",
          )
          .in("status", ["APPROVED", "PENDING"])
          .eq("auditorium_id", targetAuditoriumId)
          .gte("start_time", startStr + "T00:00:00-05:00")
          .lte("start_time", endStr + "T23:59:59-05:00");

        if (resError) throw resError;

        if (resData && resData.length > 0) {
          const reservationAssignments: TimedAssignment[] = [];
          for (const r of resData as RawReservationRow[]) {
            const bogotaTiming = getBogotaDateAndBlock(r.start_time);
            if (!bogotaTiming || !r.start_time) continue;

            const joinedUser = Array.isArray(r.users) ? r.users[0] : r.users;

            reservationAssignments.push({
              id: r.id,
              instructor_id: "RESERVA",
              assignment_date: bogotaTiming.dateStr,
              time_block: bogotaTiming.block,
              instructor: {
                full_name: joinedUser?.full_name || "RESERVA",
              },
              is_reservation: true,
              title: r.title || undefined,
              description: r.description,
              auditorium_id: r.auditorium_id || targetAuditoriumId,
              start_time: r.start_time,
              end_time: r.end_time || "",
              resources: r.resources,
              status: r.status || undefined,
              users: joinedUser || undefined,
              user_id: r.user_id || undefined,
            });
          }

          const legacyWithSpace = combined.map((item) => ({
            ...item,
            auditorium_id: item.auditorium_id || targetAuditoriumId,
          }));
          combined = mergeReservationsWithLegacy(
            reservationAssignments,
            legacyWithSpace,
          );
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
    const t = setTimeout(() => {
      void fetchAssignments();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchAssignments]);

  const deleteAssignment = useCallback(
    async (id: number, isReservation: boolean, deletedByName?: string) => {
      try {
        // Optimistic UI Update: remove matching record type immediately
        setAssignments((prev) =>
          prev.filter(
            (a) =>
              !(a.id === id && Boolean(a.is_reservation) === isReservation),
          ),
        );

        if (isReservation) {
          // Use Server Action
          const result = await cancelReservationAction(id);

          if (result.error) {
            // Revert changes if error (fetch will restore)
            await fetchAssignments();
            throw new Error(result.error);
          }

          toast.success(
            `Reserva eliminada correctamente${deletedByName ? ` por ${deletedByName}` : ""}`,
          );
        } else {
          const delRes = await deleteInstructorAssignmentAction(id);
          if (delRes.error) {
            await fetchAssignments();
            throw new Error(delRes.error);
          }
          toast.success(
            `Asignación eliminada correctamente${deletedByName ? ` por ${deletedByName}` : ""}`,
          );
        }
        // Force sync after a short delay to ensure DB propagation
        setTimeout(() => {
          void fetchAssignments();
        }, 500);

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
