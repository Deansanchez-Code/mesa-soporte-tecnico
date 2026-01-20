"use client";
// Force re-compile

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/cliente";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  X as CloseIcon,
} from "lucide-react";
import {
  TimeBlock,
  TIME_BLOCKS,
  formatDateForDB,
  isHoliday,
} from "@/lib/scheduling";
import { toast } from "sonner";

interface Assignment {
  id: number;
  instructor_id: string;
  assignment_date: string; // YYYY-MM-DD
  time_block: TimeBlock;
  instructor: {
    full_name: string;
  };
  is_reservation?: boolean;
  title?: string;
}

export default function CalendarView({
  areaId,
  canManage,
}: {
  areaId: number;
  canManage: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week"); // Default to week
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Calculate calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const weekStartRange = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEndRange = endOfWeek(currentDate, { weekStartsOn: 0 });

  const daysToRender =
    viewMode === "month"
      ? eachDayOfInterval({ start: monthStart, end: monthEnd })
      : eachDayOfInterval({ start: weekStartRange, end: weekEndRange });

  // Grid padding
  const startDayOfWeek = getDay(monthStart); // 0 (Sun) to 6 (Sat)
  const emptySlots = Array(startDayOfWeek).fill(null);

  // Wrap in useCallback to fix dependency warning
  const fetchAssignments = async () => {
    const fetchStart = viewMode === "month" ? monthStart : weekStartRange;
    const fetchEnd = viewMode === "month" ? monthEnd : weekEndRange;
    const startStr = formatDateForDB(fetchStart);
    const endStr = formatDateForDB(fetchEnd);

    console.log(
      `[Calendar] Fetching for Area: ${areaId}, Mode: ${viewMode}, Range: ${startStr} to ${endStr}`,
    );

    // 1. Fetch Assignments (Flat)
    const { data: assignData, error: assignError } = await supabase
      .from("instructor_assignments")
      .select("id, instructor_id, assignment_date, time_block")
      .eq("area_id", areaId)
      .gte("assignment_date", startStr)
      .lte("assignment_date", endStr);

    if (assignError) {
      console.error("[Calendar] Fetch Error:", assignError);
      toast.error("Error al cargar asignaciones");
      return;
    }

    if (!assignData || assignData.length === 0) {
      setAssignments([]);
      return;
    }

    // 2. Fetch Instructor Names (Batch)
    const instructorIds = Array.from(
      new Set(assignData.map((a) => a.instructor_id)),
    );
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", instructorIds);

    if (userError) {
      console.error("[Calendar] Error fetching instructors:", userError);
    }

    const userMap = new Map(userData?.map((u) => [u.id, u.full_name]) || []);

    const mergedAssignments: Assignment[] = assignData.map((a) => ({
      ...a,
      instructor: {
        full_name: userMap.get(a.instructor_id) || "Desconocido",
      },
    }));

    // 3. Fetch Reservations if it's the Auditorium
    // Assuming areaId 1 or name contains AUDITORIO
    // Better check name via a prop or fetch it. For now, check if we have any reservations for this area.
    // In AuditoriumReservationForm we use auditorium_id: "1". Let's verify areaId.

    let finalCombined = [...mergedAssignments];

    // Check if this area is the auditorium (Optimized name check)
    const { data: areaData } = await supabase
      .from("areas")
      .select("name")
      .eq("id", areaId)
      .single();

    if (areaData?.name.toUpperCase().includes("AUDITORIO")) {
      console.log(
        `[Calendar] Area ${areaId} is Auditorium (${areaData.name}). Fetching reservations...`,
      );
      const { data: resData, error: resError } = await supabase
        .from("reservations")
        .select("id, title, start_time, end_time, users(full_name)")
        .eq("status", "APPROVED")
        .gte("start_time", startStr + "T00:00:00")
        .lte("start_time", endStr + "T23:59:59");

      if (resError)
        console.error("[Calendar] Reservation Fetch Error:", resError);

      if (resData && resData.length > 0) {
        console.log(
          `[Calendar] Found ${resData.length} reservations for the range.`,
        );
        const reservationAssignments: Assignment[] = resData.map((r: any) => {
          // Obtener la fecha local real separando la parte T
          // Si el formato es ISO: 2026-01-29T..., el primer split nos da la fecha correcta
          const rawDate = r.start_time.split("T")[0];

          // Debugging log for specific dates if needed
          if (rawDate === "2026-01-29") {
            console.log(
              `[Calendar] Found reservation for Jan 29: ${r.title} at ${r.start_time}`,
            );
          }

          const startHour = new Date(r.start_time).getHours();
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
          };
        });
        finalCombined = [...finalCombined, ...reservationAssignments];
      } else {
        console.log("[Calendar] No reservations found for this range.");
      }
    }

    console.log(`[Calendar] Loaded ${finalCombined.length} total events.`);
    setAssignments(finalCombined);
  };

  const handleDelete = async (id: number, isReservation?: boolean) => {
    if (isReservation) {
      toast.error("Las reservas deben gestionarse desde el módulo de reservas");
      return;
    }
    if (!confirm("¿Eliminar esta asignación?")) return;
    const { error } = await supabase
      .from("instructor_assignments")
      .delete()
      .eq("id", id);
    if (error) toast.error("Error eliminando");
    else {
      toast.success("Eliminado");
      fetchAssignments();
    }
  };

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, areaId, viewMode]);

  const nextRange = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 7));
  };
  const prevRange = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -7));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* TOOLBAR */}
      <div className="flex justify-between items-center p-4 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-gray-700 capitalize">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy", { locale: es })
              : `Semana del ${format(weekStartRange, "d 'de' MMMM", { locale: es })}`}
          </h3>
          <div className="flex bg-gray-200 p-1 rounded-lg text-[10px] font-bold">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded ${viewMode === "week" ? "bg-white text-sena-blue shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              SEMANA
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 rounded ${viewMode === "month" ? "bg-white text-sena-blue shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              MES
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={prevRange}
            className="p-2 hover:bg-gray-200 rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextRange}
            className="p-2 hover:bg-gray-200 rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* GRID HEADER */}
      <div className="grid grid-cols-7 border-b bg-gray-100 text-xs font-bold text-gray-500 uppercase text-center py-2">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* GRID BODY */}
      <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200">
        {viewMode === "month" &&
          emptySlots.map((_, i) => (
            <div key={`empty-${i}`} className="bg-gray-50 min-h-[120px]" />
          ))}

        {daysToRender.map((day) => {
          const dayStr = formatDateForDB(day);
          const dayAssignments = assignments.filter(
            (a) => a.assignment_date === dayStr,
          );
          const isToday = isSameDay(day, new Date());
          const isHolidayDay = isHoliday(day);

          return (
            <div
              key={day.toString()}
              onClick={() => setSelectedDay(day)}
              className={`bg-white min-h-[120px] p-2 flex flex-col gap-1 transition-colors cursor-pointer 
                ${isHolidayDay ? "bg-red-50/20 border-red-400 ring-2 ring-inset ring-red-200" : ""}
                hover:bg-gray-50`}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-sena-blue text-white" : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Visual Indicators (The "3 dots" user mentioned) */}
                <div className="flex gap-0.5 mt-1">
                  {["MANANA", "TARDE", "NOCHE"].map((block) => {
                    const isOccupied = dayAssignments.some(
                      (a) => a.time_block === block,
                    );
                    return (
                      <div
                        key={block}
                        className={`w-1.5 h-1.5 rounded-full ${isOccupied ? "bg-sena-green" : "bg-gray-200"}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* ASSIGNMENTS LIST */}
              <div className="flex-1 flex flex-col gap-1 mt-1">
                {(Object.keys(TIME_BLOCKS) as TimeBlock[]).map((blockKey) => {
                  const assign = dayAssignments.find(
                    (a) => a.time_block === blockKey,
                  );

                  // In month view, hide empty blocks to save space
                  if (viewMode === "month" && !assign) return null;

                  return (
                    <div
                      key={blockKey}
                      className={`group relative text-[10px] p-1.5 rounded border border-l-4 shadow-sm transition-all overflow-hidden flex flex-col justify-center min-h-[36px]
                        ${
                          assign
                            ? "bg-green-50/50 border-l-sena-green border-green-100"
                            : "bg-gray-50/30 border-l-gray-300 border-gray-100"
                        }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span
                          className={`font-bold truncate ${assign ? "text-gray-800" : "text-gray-400 italic"} ${assign?.is_reservation ? "text-blue-700" : ""}`}
                        >
                          {assign
                            ? assign.is_reservation
                              ? `R: ${assign.title}`
                              : viewMode === "week"
                                ? assign.instructor?.full_name
                                : assign.instructor?.full_name?.split(" ")[0]
                            : `Libre (${TIME_BLOCKS[blockKey].label})`}
                        </span>
                        {assign && canManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(assign.id, assign.is_reservation);
                            }}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {viewMode === "week" && (
                        <div className="text-[9px] text-gray-500">
                          {TIME_BLOCKS[blockKey].label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* DAY DETAILS MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="bg-sena-blue p-4 flex justify-between items-center text-white">
              <div>
                <h4 className="font-bold capitalize flex items-center gap-2">
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </h4>
                <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold">
                  {(isHoliday(selectedDay) ? "Día Festivo - " : "") +
                    "Detalle de Programación"}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Cerrar"
              >
                <CloseIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {["MANANA", "TARDE", "NOCHE"].map((block) => {
                const dayStr = formatDateForDB(selectedDay);
                const dayAssigns = assignments.filter(
                  (a) => a.assignment_date === dayStr,
                );
                const assign = dayAssigns.find((a) => a.time_block === block);

                return (
                  <div
                    key={block}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      assign
                        ? "border-sena-green bg-green-50"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          assign
                            ? assign.is_reservation
                              ? "bg-blue-600 text-white"
                              : "bg-sena-green text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {TIME_BLOCKS[block as TimeBlock].label}{" "}
                        {assign?.is_reservation ? "(RESERVA)" : ""}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {TIME_BLOCKS[block as TimeBlock].range}
                      </span>
                    </div>
                    {assign ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center text-green-700 font-bold text-xs shadow-inner">
                            {assign.instructor.full_name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 leading-tight">
                              {assign.instructor.full_name}
                            </p>
                            <p className="text-[10px] text-sena-green font-bold uppercase mt-0.5">
                              Asignado
                            </p>
                          </div>
                        </div>
                        {canManage && (
                          <button
                            onClick={() => {
                              handleDelete(assign.id, assign.is_reservation);
                              setSelectedDay(null);
                            }}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        No hay instructor asignado en este bloque
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-center">
              <button
                onClick={() => setSelectedDay(null)}
                className="bg-white px-6 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
