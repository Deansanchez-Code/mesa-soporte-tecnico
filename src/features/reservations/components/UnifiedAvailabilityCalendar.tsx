"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { useReservations } from "../hooks/useReservations";
import {
  getAllSpacesMaintenanceConfig,
  getEnvironmentsGlobalConfig,
  DEFAULT_ENVIRONMENTS_CONFIG,
  resolveSpaceDisplayName,
} from "../services/maintenanceService";
import { EnvironmentsGlobalConfig, SpaceMaintenanceConfig } from "../types";
import {
  canAccessNextVigencia,
  getBogotaDateString,
  getCurrentVigenciaEndDateStr,
  getVisibleSpaceIdsForUser,
  isDateBeyondCurrentVigencia,
  ReservationActorLike,
} from "../rules/reservationRules";

interface UnifiedAvailabilityCalendarProps {
  user: ReservationActorLike & { id?: string };
  initialSpaceId?: string;
  onSelectSlot?: (selection: {
    spaceId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => void;
  onQuickReserve?: (selection: { spaceId: string; date: string }) => void;
}

type CalendarViewMode = "daily" | "weekly" | "monthly";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06..21 -> 06:00 a 22:00
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const DOW_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function addDaysStr(baseStr: string, offsetDays: number): string {
  const [y, m, d] = baseStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return dt.toISOString().slice(0, 10);
}

function getMondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export default function UnifiedAvailabilityCalendar({
  user,
  initialSpaceId,
  onSelectSlot,
  onQuickReserve,
}: UnifiedAvailabilityCalendarProps) {
  const todayStr = getBogotaDateString();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const currentBogotaHour = useMemo(() => {
    const str = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(nowMs));
    return Number(str);
  }, [nowMs]);

  const allowNextVigencia = canAccessNextVigencia(user);
  const currentVigenciaMax = getCurrentVigenciaEndDateStr();
  const visibleSpaceIds = useMemo(
    () => getVisibleSpaceIdsForUser(user),
    [user],
  );

  const [view, setView] = useState<CalendarViewMode>("daily");
  const [returnView, setReturnView] = useState<"weekly" | "monthly" | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [scopeSpaceId, setScopeSpaceId] = useState<string>(() =>
    initialSpaceId && visibleSpaceIds.includes(initialSpaceId)
      ? initialSpaceId
      : "ALL",
  );

  useEffect(() => {
    const nextScope =
      initialSpaceId && visibleSpaceIds.includes(initialSpaceId)
        ? initialSpaceId
        : "ALL";
    const t = setTimeout(() => setScopeSpaceId(nextScope), 0);
    return () => clearTimeout(t);
  }, [initialSpaceId, visibleSpaceIds]);

  const dailySpaceIds = useMemo(
    () =>
      scopeSpaceId === "ALL"
        ? visibleSpaceIds
        : visibleSpaceIds.filter((id) => id === scopeSpaceId),
    [scopeSpaceId, visibleSpaceIds],
  );

  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = todayStr.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  });
  const [weekStartStr, setWeekStartStr] = useState(() =>
    getMondayOfWeek(todayStr),
  );

  // Rango consultado según vista activa
  const { queryStart, queryEnd } = useMemo(() => {
    if (view === "weekly") {
      return {
        queryStart: weekStartStr,
        queryEnd: addDaysStr(weekStartStr, 6),
      };
    }
    if (view === "monthly") {
      const first = `${monthCursor.year}-${String(monthCursor.monthIndex + 1).padStart(2, "0")}-01`;
      const daysInMonth = new Date(
        Date.UTC(monthCursor.year, monthCursor.monthIndex + 1, 0),
      ).getUTCDate();
      const last = `${monthCursor.year}-${String(monthCursor.monthIndex + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      return { queryStart: first, queryEnd: last };
    }
    return { queryStart: selectedDate, queryEnd: selectedDate };
  }, [view, weekStartStr, monthCursor, selectedDate]);

  const { reservations, loading } = useReservations({
    userId: user?.id || "",
    startDate: queryStart,
    finalDate: queryEnd,
  });

  const [spacesMaintenance, setSpacesMaintenance] = useState<
    Record<string, SpaceMaintenanceConfig>
  >({});
  const [envGlobalConfig, setEnvGlobalConfig] =
    useState<EnvironmentsGlobalConfig>(DEFAULT_ENVIRONMENTS_CONFIG);

  useEffect(() => {
    getAllSpacesMaintenanceConfig()
      .then((cfgs) => setSpacesMaintenance(cfgs || {}))
      .catch(() => {});
    getEnvironmentsGlobalConfig()
      .then((cfg) => setEnvGlobalConfig(cfg))
      .catch(() => {});
  }, []);

  const isSpacePaused = (spaceId: string) =>
    envGlobalConfig.disabled_special_spaces.map(String).includes(spaceId) ||
    Boolean(spacesMaintenance[spaceId]?.is_active);

  const isHourPast = (dateStr: string, hour: number) => {
    if (dateStr < todayStr) return true;
    if (dateStr === todayStr) return hour <= currentBogotaHour;
    return false;
  };

  const getReservationAtHour = (
    spaceId: string,
    dateStr: string,
    hour: number,
  ) => {
    const slotStart = new Date(`${dateStr}T${formatHour(hour)}:00-05:00`);
    const slotEnd = new Date(`${dateStr}T${formatHour(hour + 1)}:00-05:00`);
    return reservations.find((r) => {
      if (String(r.auditorium_id || "1") !== spaceId) return false;
      const rStart = new Date(r.start_time).getTime();
      const rEnd = new Date(r.end_time).getTime();
      return slotStart.getTime() < rEnd && slotEnd.getTime() > rStart;
    });
  };

  const computeDaySemaphore = (dateStr: string, scopeId: string) => {
    const evaluated =
      scopeId === "ALL"
        ? visibleSpaceIds.filter((id) => !isSpacePaused(id))
        : visibleSpaceIds.filter((id) => id === scopeId);

    if (
      evaluated.length === 0 ||
      (scopeId !== "ALL" && isSpacePaused(evaluated[0]))
    ) {
      return {
        state: "full" as const,
        label: "En pausa",
      };
    }

    const bookableHours = HOURS.filter((h) => !isHourPast(dateStr, h));
    if (bookableHours.length === 0) {
      return {
        state: "full" as const,
        label: "Sin horario",
      };
    }

    let freeCount = 0;
    const matchedIds = new Set<number | string>();

    for (const spId of evaluated) {
      for (const h of bookableHours) {
        const res = getReservationAtHour(spId, dateStr, h);
        if (res) {
          matchedIds.add(res.id);
        } else {
          freeCount++;
        }
      }
    }

    if (freeCount === 0) {
      return { state: "full" as const, label: "Ocupado todo el día" };
    }
    if (matchedIds.size === 0) {
      return { state: "free" as const, label: "Libre total" };
    }
    return {
      state: "partial" as const,
      label: `${matchedIds.size} res · con cupo`,
    };
  };

  const handleDrillDownToDay = (
    dateStr: string,
    from: "weekly" | "monthly",
  ) => {
    if (dateStr < todayStr) return;
    if (!allowNextVigencia && isDateBeyondCurrentVigencia(dateStr)) {
      toast.info("Fecha no disponible para reserva.");
      return;
    }
    setSelectedDate(dateStr);
    setReturnView(from);
    setView("daily");
  };

  const isDateDisabled = (dateStr: string) => {
    if (dateStr < todayStr) return true;
    if (!allowNextVigencia && isDateBeyondCurrentVigencia(dateStr)) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Cabecera de pestañas: Diaria -> Semanal -> Mensual */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {view === "daily" && returnView && (
            <button
              type="button"
              onClick={() => {
                setView(returnView);
                setReturnView(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {returnView === "monthly"
                ? "Volver a Mensual"
                : "Volver a Semanal"}
            </button>
          )}

          <select
            value={scopeSpaceId}
            onChange={(e) => setScopeSpaceId(e.target.value)}
            aria-label="Filtrar disponibilidad por ambiente"
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#39A900]"
          >
            <option value="ALL">Todos los ambientes</option>
            {visibleSpaceIds.map((id) => (
              <option key={id} value={id}>
                {resolveSpaceDisplayName(id)}
              </option>
            ))}
          </select>

          {scopeSpaceId !== "ALL" &&
            !isSpacePaused(scopeSpaceId) &&
            onQuickReserve && (
              <button
                type="button"
                onClick={() =>
                  onQuickReserve({ spaceId: scopeSpaceId, date: selectedDate })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#39A900] hover:bg-[#2d8500] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Solicitar Reserva
              </button>
            )}
        </div>

        <div
          className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1"
          role="group"
          aria-label="Vistas de calendario"
        >
          {(
            [
              { id: "daily", label: "Diaria" },
              { id: "weekly", label: "Semanal" },
              { id: "monthly", label: "Mensual" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setReturnView(null);
                setView(tab.id);
              }}
              aria-pressed={view === tab.id}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                view === tab.id
                  ? "bg-[#043263] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      {view === "daily" ? (
        <div className="flex flex-wrap gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#39A900]" />
            Hora libre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#043263]" />
            Ocupado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
            Prerreserva
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#FC7323]" />
            En Pausa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" />
            Hora pasada
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#39A900]" />
            Libre totalmente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
            Con reservas (hay cupo)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-red-600" />
            Ocupado todo el día
          </span>
        </div>
      )}

      {/* VISTA DIARIA */}
      {view === "daily" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                min={todayStr}
                max={!allowNextVigencia ? currentVigenciaMax : undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val || val < todayStr) {
                    setSelectedDate(todayStr);
                    return;
                  }
                  if (!allowNextVigencia && isDateBeyondCurrentVigencia(val)) {
                    setSelectedDate(currentVigenciaMax);
                    toast.info("Fecha no disponible para reserva.");
                    return;
                  }
                  setSelectedDate(val);
                }}
                aria-label="Fecha de disponibilidad diaria"
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#39A900]"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addDaysStr(todayStr, 1);
                  if (!isDateDisabled(next)) setSelectedDate(next);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Mañana
              </button>
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {loading
                ? "Actualizando disponibilidad..."
                : "Haz clic en una hora libre para reservar"}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 w-44 border-r border-slate-200">
                    Ambiente
                  </th>
                  {HOURS.map((h) => (
                    <th
                      key={h}
                      className="px-1 py-2 text-[11px] font-bold tabular-mono text-slate-500 text-center border-r last:border-r-0 border-slate-200"
                    >
                      {String(h).padStart(2, "0")}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dailySpaceIds.map((spaceId) => {
                  const name = resolveSpaceDisplayName(spaceId);
                  const paused = isSpacePaused(spaceId);

                  return (
                    <tr key={spaceId}>
                      <td className="px-3 py-2 bg-slate-50/60 border-r border-slate-200 font-bold text-xs text-slate-800">
                        {name}
                      </td>
                      {paused ? (
                        <td colSpan={HOURS.length} className="p-2">
                          <div className="px-3 py-2 rounded-lg bg-orange-50 border border-dashed border-[#FC7323] text-[#9A3412] text-xs font-bold flex items-center justify-between">
                            <span>
                              Fuera de servicio temporalmente — reservas
                              bloqueadas.
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#FC7323] text-white text-[10px]">
                              EN PAUSA
                            </span>
                          </div>
                        </td>
                      ) : (
                        HOURS.map((h) => {
                          const past = isHourPast(selectedDate, h);
                          const res = getReservationAtHour(
                            spaceId,
                            selectedDate,
                            h,
                          );

                          if (past) {
                            return (
                              <td
                                key={h}
                                className="p-0.5 border-r last:border-r-0 border-slate-200"
                              >
                                <div
                                  title={`${formatHour(h)} - ${formatHour(h + 1)} (Hora pasada)`}
                                  className="h-10 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold tabular-mono text-slate-400 flex items-center justify-center opacity-60 cursor-not-allowed"
                                >
                                  {res ? "FIN" : "PAS"}
                                </div>
                              </td>
                            );
                          }

                          if (res) {
                            const isPending = res.status === "PENDING";
                            return (
                              <td
                                key={h}
                                className="p-0.5 border-r last:border-r-0 border-slate-200"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    toast.info(
                                      `${name} (${formatHour(h)}-${formatHour(h + 1)}): ${res.title}`,
                                    )
                                  }
                                  title={`${formatHour(h)} - ${formatHour(h + 1)}: ${res.title}`}
                                  className={`w-full h-10 rounded border text-[10px] font-bold tabular-mono flex items-center justify-center cursor-pointer ${
                                    isPending
                                      ? "bg-amber-50 border-amber-300 text-amber-800"
                                      : "bg-blue-50 border-blue-200 text-[#043263]"
                                  }`}
                                >
                                  {isPending ? "PRER" : "OCUP"}
                                </button>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={h}
                              className="p-0.5 border-r last:border-r-0 border-slate-200"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (onSelectSlot) {
                                    onSelectSlot({
                                      spaceId,
                                      date: selectedDate,
                                      startTime: formatHour(h),
                                      endTime: formatHour(Math.min(22, h + 1)),
                                    });
                                  }
                                }}
                                title={`Libre ${formatHour(h)} - ${formatHour(h + 1)} (Clic para reservar)`}
                                className="w-full h-10 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center transition cursor-pointer"
                              >
                                +
                              </button>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA SEMANAL */}
      {view === "weekly" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const prev = addDaysStr(weekStartStr, -7);
                if (addDaysStr(prev, 6) < todayStr) return;
                setWeekStartStr(prev);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Semana anterior
            </button>
            <h4 className="text-sm font-black text-slate-800">
              Semana {formatShortDate(weekStartStr)} al{" "}
              {formatShortDate(addDaysStr(weekStartStr, 6))} (
              {weekStartStr.slice(0, 4)})
            </h4>
            <button
              type="button"
              onClick={() => {
                const next = addDaysStr(weekStartStr, 7);
                if (!allowNextVigencia && isDateBeyondCurrentVigencia(next)) {
                  toast.info("No hay calendario habilitado en ese rango.");
                  return;
                }
                setWeekStartStr(next);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Semana siguiente
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
            {Array.from({ length: 7 }, (_, i) => {
              const dateStr = addDaysStr(weekStartStr, i);
              const disabled = isDateDisabled(dateStr);
              const sem = disabled
                ? null
                : computeDaySemaphore(dateStr, scopeSpaceId);

              const headerStyle = disabled
                ? "bg-slate-100 text-slate-400"
                : sem?.state === "free"
                  ? "bg-emerald-50 text-emerald-900"
                  : sem?.state === "partial"
                    ? "bg-amber-50 text-amber-900"
                    : "bg-red-50 text-red-900";

              const evaluatedIds =
                scopeSpaceId === "ALL"
                  ? visibleSpaceIds
                  : visibleSpaceIds.filter((id) => id === scopeSpaceId);

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDrillDownToDay(dateStr, "weekly")}
                  className={`rounded-xl border border-slate-200 bg-white overflow-hidden text-left transition flex flex-col ${
                    disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  }`}
                >
                  <div
                    className={`px-2.5 py-2 border-b border-slate-100 ${headerStyle}`}
                  >
                    <div className="text-xs font-black">
                      {DOW_SHORT[i]} {formatShortDate(dateStr)}
                    </div>
                    <div className="text-[11px] font-bold">
                      {disabled ? "No disponible" : sem?.label}
                    </div>
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    {evaluatedIds.map((spId) => {
                      const spSem = computeDaySemaphore(dateStr, spId);
                      const paused = isSpacePaused(spId);
                      const dotColor = paused
                        ? "bg-[#FC7323]"
                        : spSem.state === "free"
                          ? "bg-[#39A900]"
                          : spSem.state === "partial"
                            ? "bg-amber-500"
                            : "bg-red-600";
                      return (
                        <div
                          key={spId}
                          className="flex items-center justify-between gap-1 px-1.5 py-1 rounded bg-slate-50 text-[11px] font-semibold text-slate-700"
                        >
                          <span className="truncate">
                            {resolveSpaceDisplayName(spId)}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTA MENSUAL */}
      {view === "monthly" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                let m = monthCursor.monthIndex - 1;
                let y = monthCursor.year;
                if (m < 0) {
                  m = 11;
                  y -= 1;
                }
                const [ty, tm] = todayStr.split("-").map(Number);
                if (y < ty || (y === ty && m < tm - 1)) return;
                setMonthCursor({ year: y, monthIndex: m });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Mes anterior
            </button>
            <h4 className="text-sm font-black text-slate-800 capitalize">
              {MONTH_NAMES[monthCursor.monthIndex]} {monthCursor.year}
            </h4>
            <button
              type="button"
              onClick={() => {
                let m = monthCursor.monthIndex + 1;
                let y = monthCursor.year;
                if (m > 11) {
                  m = 0;
                  y += 1;
                }
                const currentYear = Number(todayStr.slice(0, 4));
                if (!allowNextVigencia && y > currentYear) {
                  toast.info("No hay calendario habilitado en ese rango.");
                  return;
                }
                setMonthCursor({ year: y, monthIndex: m });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Mes siguiente
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {DOW_SHORT.map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-bold uppercase text-slate-400 py-1"
              >
                {d}
              </div>
            ))}
            {(() => {
              const firstDay = new Date(
                Date.UTC(monthCursor.year, monthCursor.monthIndex, 1),
              );
              const firstDow = firstDay.getUTCDay();
              const offset = firstDow === 0 ? 6 : firstDow - 1;
              const daysInMonth = new Date(
                Date.UTC(monthCursor.year, monthCursor.monthIndex + 1, 0),
              ).getUTCDate();

              const cells = [];
              for (let i = 0; i < offset; i++) {
                cells.push(<div key={`empty-${i}`} />);
              }

              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${monthCursor.year}-${String(monthCursor.monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const disabled = isDateDisabled(dateStr);
                const sem = disabled
                  ? null
                  : computeDaySemaphore(dateStr, scopeSpaceId);

                const cellStyle = disabled
                  ? "bg-slate-100 border-slate-200 text-slate-400 opacity-55 cursor-not-allowed"
                  : sem?.state === "free"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-950 hover:shadow-sm cursor-pointer"
                    : sem?.state === "partial"
                      ? "bg-amber-50 border-amber-300 text-amber-950 hover:shadow-sm cursor-pointer"
                      : "bg-red-50 border-red-300 text-red-950 hover:shadow-sm cursor-pointer";

                cells.push(
                  <button
                    key={dateStr}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDrillDownToDay(dateStr, "monthly")}
                    className={`min-h-[72px] p-2 rounded-xl border text-left flex flex-col justify-between transition ${cellStyle}`}
                  >
                    <span className="text-xs font-black tabular-mono">
                      {day}
                    </span>
                    <span className="text-[10px] font-bold leading-tight">
                      {disabled ? "No disponible" : sem?.label}
                    </span>
                  </button>,
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
