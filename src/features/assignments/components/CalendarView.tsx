"use client";
// Force re-compile

import { useState, useEffect } from "react";
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
  Pencil,
  X as CloseIcon,
} from "lucide-react";
import {
  TimeBlock,
  TIME_BLOCKS,
  formatDateForDB,
  isHoliday,
} from "@/lib/scheduling";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

import { useAssignments } from "../hooks/useAssignments";
import { Assignment } from "../types";

import { UserProfile } from "@/features/auth/hooks/useUserProfile";

export default function CalendarView({
  areaId,
  areaName,
  canManage,
  canDeleteAuditorium,
  user,
  onEdit,
}: {
  areaId: number;
  areaName: string;
  canManage: boolean;
  canDeleteAuditorium: boolean;
  user?: UserProfile["profile"];
  onEdit?: (assign: Assignment) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week"); // Default to week

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

  const fetchStart = viewMode === "month" ? monthStart : weekStartRange;
  const fetchEnd = viewMode === "month" ? monthEnd : weekEndRange;

  const { assignments, deleteAssignment } = useAssignments({
    areaId,
    areaName,
    fetchStart,
    fetchEnd,
  });

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] =
    useState<Assignment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);

  const handleDelete = async (id: number, isReservation?: boolean) => {
    const assignment = assignments.find((a) => a.id === id);
    if (!assignment) return;

    // 1. Restriction: Past/Current events cannot be deleted by non-admins
    if (isReservation && assignment.start_time) {
      const startTime = new Date(assignment.start_time);
      const now = new Date();
      if (now >= startTime) {
        if (!canDeleteAuditorium) {
          // canDeleteAuditorium is true for admin/superadmin
          toast.error("No se pueden eliminar eventos en curso o finalizados.");
          return;
        }
      }
    }

    if (isReservation) {
      const isOwner =
        user?.id &&
        assignment.user_id &&
        user.id.toLowerCase() === assignment.user_id.toLowerCase();
      if (!canManage && !isOwner && !canDeleteAuditorium && !user?.is_vip) {
        toast.error("No tienes permisos para eliminar esta reserva");
        return;
      }
    } else {
      if (!canManage) {
        toast.error("No tienes permisos para eliminar esta asignación");
        return;
      }
    }

    setAssignmentToDelete(assignment);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!assignmentToDelete) return;
    setIsDeletingLocal(true);
    const { success } = await deleteAssignment(
      assignmentToDelete.id,
      !!assignmentToDelete.is_reservation,
      user?.full_name,
    );
    setIsDeletingLocal(false);
    if (success) {
      setShowDeleteConfirm(false);
      setAssignmentToDelete(null);
      setSelectedAssignment(null);
    }
  };

  useEffect(() => {
    // Refresh when currentDate or viewMode changes handled by hook dependencies if we pass them
    // But since we pass dates derived from currentDate, hook already refetches.
  }, [currentDate, viewMode]);

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
              onClick={() => {
                setSelectedDay(day);
                setSelectedAssignment(null);
              }}
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

                {/* Visual Indicators (The "3 dots" user mentioned) Or Single Bar for Auditorium */}
                <div className="flex gap-0.5 mt-1">
                  {areaName.toUpperCase().includes("AUDITORIO") ? (
                    // Single indicator for Auditorium
                    <div
                      className={`w-full h-1.5 rounded-full ${
                        dayAssignments.length > 0
                          ? "bg-blue-500"
                          : "bg-gray-200"
                      }`}
                    />
                  ) : (
                    // Standard 3 dots for environments
                    ["MANANA", "TARDE", "NOCHE"].map((block) => {
                      const isOccupied = dayAssignments.some(
                        (a) => a.time_block === block,
                      );
                      return (
                        <div
                          key={block}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOccupied ? "bg-sena-green" : "bg-gray-200"
                          }`}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* ASSIGNMENTS LIST */}
              <div className="flex-1 flex flex-col gap-1 mt-1">
                {areaName.toUpperCase().includes("AUDITORIO")
                  ? dayAssignments.map((assign) => {
                      // Calculate duration for sizing
                      let durationHours = 1;
                      if (assign.start_time && assign.end_time) {
                        const start = new Date(assign.start_time).getTime();
                        const end = new Date(assign.end_time).getTime();
                        durationHours = (end - start) / (1000 * 60 * 60);
                      }

                      // Base height per hour (e.g., 30px per hour)
                      // Min height 40px to fit text
                      const heightPx = Math.max(40, durationHours * 30);

                      return (
                        <div
                          key={assign.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(day);
                            setSelectedAssignment(assign);
                          }}
                          style={{ height: `${heightPx}px` }}
                          className="group relative text-[10px] p-1 rounded border border-l-2 shadow-sm bg-blue-50/50 border-l-blue-600 border-blue-100 flex flex-col justify-start min-h-[36px] overflow-hidden"
                        >
                          <div className="flex justify-between items-center w-full leading-tight">
                            <span className="font-bold truncate text-blue-900 w-full pr-1">
                              {assign.title || assign.instructor.full_name}
                            </span>
                            {/* Only show delete if authorized AND not started (unless admin) */}
                            {canDeleteAuditorium && assign.is_reservation && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(assign.id, true);
                                }}
                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0.5 top-0.5 bg-white/90 rounded-full p-0.5 shadow-sm"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                          <div className="text-[8px] tracking-tighter text-blue-600 leading-none mt-auto">
                            {assign.start_time
                              ? `${format(new Date(assign.start_time), "HH:mm")} - ${format(new Date(assign.end_time || ""), "HH:mm")}`
                              : ""}
                          </div>
                        </div>
                      );
                    })
                  : // STANDARD ENVIRONMENTS: Time Blocks
                    (Object.keys(TIME_BLOCKS) as TimeBlock[]).map(
                      (blockKey) => {
                        const assign = dayAssignments.find(
                          (a) => a.time_block === blockKey,
                        );

                        // In month view, hide empty blocks to save space
                        if (viewMode === "month" && !assign) return null;

                        return (
                          <div
                            key={blockKey}
                            onClick={(e) => {
                              if (assign) {
                                e.stopPropagation();
                                setSelectedDay(day);
                                setSelectedAssignment(assign);
                              }
                            }}
                            className={`group relative text-[10px] p-1.5 rounded border border-l-4 shadow-sm transition-all overflow-hidden flex flex-col justify-center min-h-[36px]
                        ${
                          assign
                            ? "bg-green-50/50 border-l-sena-green border-green-100"
                            : "bg-gray-50/30 border-l-gray-300 border-gray-100"
                        }`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span
                                className={`font-bold truncate ${
                                  assign
                                    ? "text-gray-800"
                                    : "text-gray-400 italic"
                                } ${assign?.is_reservation ? "text-blue-700" : ""}`}
                              >
                                {assign
                                  ? assign.is_reservation
                                    ? `R: ${assign.title}`
                                    : viewMode === "week"
                                      ? assign.instructor?.full_name
                                      : assign.instructor?.full_name?.split(
                                          " ",
                                        )[0]
                                  : `Libre (${TIME_BLOCKS[blockKey].label})`}
                              </span>
                              {assign &&
                                (canManage ||
                                  (assign.is_reservation &&
                                    user?.id === assign.user_id)) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(
                                        assign.id,
                                        assign.is_reservation,
                                      );
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
                      },
                    )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DAY DETAILS MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh] animate-in zoom-in-95 scrollbar-thin scrollbar-thumb-gray-200">
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
                onClick={() => {
                  setSelectedDay(null);
                  setSelectedAssignment(null);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Cerrar"
              >
                <CloseIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {areaName.toUpperCase().includes("AUDITORIO")
                ? // AUDITORIUM: Render by Assignment directly (sorted by time)
                  assignments
                    .filter(
                      (a) => a.assignment_date === formatDateForDB(selectedDay),
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.start_time || 0).getTime() -
                        new Date(b.start_time || 0).getTime(),
                    )
                    .map((assign) => {
                      if (
                        selectedAssignment &&
                        assign.id !== selectedAssignment.id
                      )
                        return null;

                      return (
                        <div
                          key={assign.id}
                          className="p-4 rounded-xl border-2 transition-all border-blue-100 bg-blue-50"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner bg-blue-200 text-blue-700">
                                  {assign.instructor.full_name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-800 leading-tight">
                                    {assign.instructor.full_name}
                                  </p>
                                  <p className="text-[10px] font-bold uppercase mt-0.5 text-blue-600">
                                    Responsable
                                  </p>
                                </div>
                              </div>

                              {/* ACTION BUTTONS */}
                              {(canManage ||
                                canDeleteAuditorium ||
                                !!user?.is_vip ||
                                (assign.is_reservation &&
                                  user?.id &&
                                  assign.user_id &&
                                  user.id.toLowerCase() ===
                                    assign.user_id.toLowerCase())) && (
                                <div className="flex gap-1">
                                  {assign.is_reservation && onEdit && (
                                    <button
                                      onClick={() => {
                                        onEdit(assign);
                                        setSelectedDay(null);
                                      }}
                                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                                      title="Editar"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleDelete(
                                        assign.id,
                                        assign.is_reservation,
                                      );
                                      setSelectedDay(null);
                                    }}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="mt-1 bg-white rounded-lg p-3 border border-blue-100 space-y-3">
                              <div>
                                <h5 className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">
                                  Evento / Actividad
                                </h5>
                                <p className="text-sm font-bold text-blue-900 leading-tight">
                                  {assign.title}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-3">
                                <div>
                                  <p className="text-[10px] text-blue-400 font-bold uppercase">
                                    Inicio
                                  </p>
                                  <p className="text-sm text-gray-700 font-medium">
                                    {assign.start_time
                                      ? format(
                                          new Date(assign.start_time),
                                          "p",
                                          {
                                            locale: es,
                                          },
                                        )
                                      : "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-blue-400 font-bold uppercase">
                                    Fin
                                  </p>
                                  <p className="text-sm text-gray-700 font-medium">
                                    {assign.end_time
                                      ? format(new Date(assign.end_time), "p", {
                                          locale: es,
                                        })
                                      : "N/A"}
                                  </p>
                                </div>
                              </div>

                              {assign.resources &&
                                assign.resources.length > 0 && (
                                  <div className="border-t border-blue-100 pt-3">
                                    <p className="text-[10px] text-blue-400 font-bold uppercase mb-1.5">
                                      Recursos Solicitados
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {assign.resources.map((res, i) => (
                                        <span
                                          key={i}
                                          className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold border border-blue-200"
                                        >
                                          {res}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                : ["MANANA", "TARDE", "NOCHE"].map((block) => {
                    const dayStr = formatDateForDB(selectedDay);
                    const dayAssigns = assignments.filter(
                      (a) => a.assignment_date === dayStr,
                    );
                    const assign = dayAssigns.find(
                      (a) => a.time_block === block,
                    );

                    // FOCUS LOGIC: If an assignment is selected, ONLY show that one
                    if (
                      selectedAssignment &&
                      assign &&
                      assign.id !== selectedAssignment.id
                    )
                      return null;
                    if (selectedAssignment && !assign) return null;

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
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner ${
                                    assign.is_reservation
                                      ? "bg-blue-200 text-blue-700"
                                      : "bg-green-200 text-green-700"
                                  }`}
                                >
                                  {assign.instructor.full_name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-800 leading-tight">
                                    {assign.instructor.full_name}
                                  </p>
                                  <p
                                    className={`text-[10px] font-bold uppercase mt-0.5 ${
                                      assign.is_reservation
                                        ? "text-blue-600"
                                        : "text-sena-green"
                                    }`}
                                  >
                                    {assign.is_reservation
                                      ? "Responsable"
                                      : "Instructor Asignado"}
                                  </p>
                                </div>
                              </div>
                              {(canManage ||
                                canDeleteAuditorium ||
                                !!user?.is_vip ||
                                (assign.is_reservation &&
                                  user?.id &&
                                  assign.user_id &&
                                  user.id.toLowerCase() ===
                                    assign.user_id.toLowerCase())) && (
                                <div className="flex gap-1">
                                  {assign.is_reservation && onEdit && (
                                    <button
                                      onClick={() => {
                                        onEdit(assign);
                                        setSelectedDay(null);
                                      }}
                                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                                      title="Editar"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleDelete(
                                        assign.id,
                                        assign.is_reservation,
                                      );
                                      setSelectedDay(null);
                                    }}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {assign.is_reservation && (
                              <div className="mt-1 bg-blue-50/50 rounded-lg p-3 border border-blue-100 space-y-3">
                                <div>
                                  <h5 className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">
                                    Evento / Actividad
                                  </h5>
                                  <p className="text-sm font-bold text-blue-900 leading-tight">
                                    {assign.title}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-3">
                                  <div>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase">
                                      Inicio
                                    </p>
                                    <p className="text-sm text-gray-700 font-medium">
                                      {assign.start_time
                                        ? format(
                                            new Date(assign.start_time),
                                            "p",
                                            {
                                              locale: es,
                                            },
                                          )
                                        : "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase">
                                      Fin
                                    </p>
                                    <p className="text-sm text-gray-700 font-medium">
                                      {assign.end_time
                                        ? format(
                                            new Date(assign.end_time),
                                            "p",
                                            {
                                              locale: es,
                                            },
                                          )
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>

                                {assign.resources &&
                                  assign.resources.length > 0 && (
                                    <div className="border-t border-blue-100 pt-3">
                                      <p className="text-[10px] text-blue-400 font-bold uppercase mb-1.5">
                                        Recursos Solicitados
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {assign.resources.map((res, i) => (
                                          <span
                                            key={i}
                                            className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold border border-blue-200"
                                          >
                                            {res}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
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
                onClick={() => {
                  setSelectedDay(null);
                  setSelectedAssignment(null);
                }}
                className="bg-white px-6 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title={
          assignmentToDelete?.is_reservation
            ? "Eliminar Reserva"
            : "Eliminar Asignación"
        }
        message={
          assignmentToDelete?.is_reservation
            ? `¿Estás seguro de eliminar la reserva: "${assignmentToDelete.title}"?`
            : `¿Estás seguro de eliminar la asignación de ${assignmentToDelete?.instructor?.full_name}?`
        }
        confirmText="Eliminar"
        variant="danger"
        isLoading={isDeletingLocal}
      />
    </div>
  );
}
