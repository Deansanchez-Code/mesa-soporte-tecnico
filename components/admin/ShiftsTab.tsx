"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ShiftsReportTab from "@/components/admin/ShiftsReportTab";
import {
  Calendar,
  Clock,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Save,
  Settings,
  Trash2,
  Plus,
} from "lucide-react";
import { format, startOfWeek, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { User } from "@/app/admin/types";

// --- Tipos Locales ---
interface DailySchedule {
  start: string; // "08:00"
  end: string; // "17:00"
  is_off?: boolean;
}

interface WeeklyScheduleMap {
  [agentId: string]: {
    days: { [dateIso: string]: DailySchedule }; // key: "2024-05-20"
    id?: number; // DB ID if exists
    saved: boolean;
  };
}

export default function ShiftsTab() {
  const [activeSubTab, setActiveSubTab] = useState<"planner" | "report">(
    "planner",
  );

  // --- Configuración de Presets ---
  const DEFAULT_PRESETS = [
    { id: "p1", label: "Oficina (8am - 5pm)", start: "08:00", end: "17:00" },
    { id: "p2", label: "Mañana (6am - 2pm)", start: "06:00", end: "14:00" },
    { id: "p3", label: "Tarde (2pm - 10pm)", start: "14:00", end: "22:00" },
    { id: "p4", label: "Noche (10pm - 6am)", start: "22:00", end: "06:00" },
  ];

  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_shift_presets");
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading presets", e);
      }
    }
  }, []);

  const handleSavePresets = (newPresets: typeof DEFAULT_PRESETS) => {
    setPresets(newPresets);
    localStorage.setItem("admin_shift_presets", JSON.stringify(newPresets));
    setShowConfigModal(false);
    toast.success("Tipos de turno actualizados");
  };

  // State Planner
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday start
  );

  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<WeeklyScheduleMap>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Agents (Roles: agent, admin if they have shifts?)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/admin/users?limit=100", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");

      const agentList = (data.users || []).filter(
        (u: User) => u.role === "agent" || u.role === "admin",
      );
      setAgents(agentList);

      // 2. Fetch Schedules for this week
      // date range
      const startIso = format(currentWeekStart, "yyyy-MM-dd");

      const { data: dbSchedules, error } = await supabase
        .from("weekly_schedules")
        .select("*")
        .eq("week_start_date", startIso);

      if (error) {
        console.error("DB Error:", error);
        // If generic check fails, we might just have empty schedules
      }

      // Parse DB schedules to local map
      const newMap: WeeklyScheduleMap = {};

      // Init empty map for all agents
      agentList.forEach((a: User) => {
        newMap[a.id] = { days: {}, saved: true };
      });

      // Fill from DB
      dbSchedules?.forEach((sch) => {
        if (newMap[sch.user_id]) {
          newMap[sch.user_id].id = sch.id;
          newMap[sch.user_id].days = sch.schedule_config || {};
        }
      });

      setSchedules(newMap);
    } catch (err) {
      console.error(err);
      toast.error("Error cargando datos del planificador");
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  // --- Effects ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Helpers ---
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) =>
      addDays(currentWeekStart, i),
    );
  }, [currentWeekStart]);

  const handlePrevWeek = () =>
    setCurrentWeekStart(subDays(currentWeekStart, 7));
  const handleNextWeek = () =>
    setCurrentWeekStart(addDays(currentWeekStart, 7));

  // --- Actions ---
  const handleCellChange = (
    agentId: string,
    dateIso: string,
    field: "start" | "end",
    value: string,
  ) => {
    setSchedules((prev) => {
      const agentSch = prev[agentId]
        ? { ...prev[agentId] }
        : { days: {}, saved: true };
      const daySch = agentSch.days[dateIso]
        ? { ...agentSch.days[dateIso] }
        : { start: "", end: "", is_off: false };

      daySch[field] = value;
      agentSch.days[dateIso] = daySch;
      agentSch.saved = false;

      return { ...prev, [agentId]: agentSch };
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    let successCount = 0;
    const updates = Object.entries(schedules).filter(([, data]) => !data.saved); // Only unsaved

    try {
      for (const [agentId, data] of updates) {
        const payload = {
          user_id: agentId,
          week_start_date: format(currentWeekStart, "yyyy-MM-dd"),
          schedule_config: data.days,
        };

        const { error } = await supabase
          .from("weekly_schedules")
          .upsert(payload, { onConflict: "user_id, week_start_date" });

        if (error) throw error;

        // Mark as saved locally
        setSchedules((prev) => ({
          ...prev,
          [agentId]: { ...prev[agentId], saved: true },
        }));
        successCount++;
      }
      if (successCount > 0)
        toast.success(`Guardados ${successCount} horarios.`);
      else toast.info("No hay cambios pendientes.");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  // Presets de Turnos
  const SHIFT_PRESETS = [
    { label: "Seleccionar Turno...", value: "" },
    { label: "Oficina (8am - 5pm)", start: "08:00", end: "17:00" },
    { label: "Mañana (6am - 2pm)", start: "06:00", end: "14:00" },
    { label: "Tarde (2pm - 10pm)", start: "14:00", end: "22:00" },
    { label: "Noche (10pm - 6am)", start: "22:00", end: "06:00" },
    { label: "Limpiar Semana", start: "", end: "" },
  ];

  const applyPreset = (agentId: string, start: string, end: string) => {
    setSchedules((prev) => {
      const agentSch = prev[agentId]
        ? { ...prev[agentId] }
        : { days: {}, saved: false };
      agentSch.saved = false;
      const newDays = { ...agentSch.days };

      weekDays.forEach((d) => {
        const dayStr = format(d, "yyyy-MM-dd");
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        if (!isWeekend) {
          if (start && end) {
            newDays[dayStr] = { start, end, is_off: false };
          } else {
            // Clear
            newDays[dayStr] = { start: "", end: "", is_off: false };
          }
        }
      });
      agentSch.days = newDays;
      return { ...prev, [agentId]: agentSch };
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-sena-green" />
            Gestión de Turnos y Asistencia
          </h2>
          <p className="text-sm text-gray-500">
            Planifique turnos semanales y revise el cumplimiento de horarios.
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab("planner")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeSubTab === "planner"
                ? "bg-white text-sena-green shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Planificador
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab("report")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeSubTab === "report"
                ? "bg-white text-sena-green shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Reportes
            </div>
          </button>
        </div>
      </div>

      {activeSubTab === "planner" ? (
        <div className="space-y-4">
          {/* Week Controls */}
          <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrevWeek}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-lg text-gray-700 capitalize">
                {format(currentWeekStart, "MMMM yyyy", { locale: es })} - Semana
                del {format(currentWeekStart, "dd")}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfigModal(true)}
                className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                title="Configurar Tipos de Turno"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 bg-sena-green text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Cambios
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-gray-50 z-10 w-48">
                    Agente
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.toString()}
                      className="px-4 py-3 min-w-[140px] text-center"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">
                          {format(day, "EEEE", { locale: es })}
                        </span>
                        <span className="text-gray-500 text-[10px]">
                          {format(day, "dd MMM")}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      Cargando...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      No hay agentes registrados.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 font-medium text-gray-900 border-r">
                        <div>{agent.full_name}</div>
                        <div className="text-xs text-gray-500">
                          {agent.username}
                        </div>
                        <select
                          className="mt-2 text-xs border rounded p-1 w-full bg-gray-50"
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const preset = SHIFT_PRESETS.find(
                              (p) => p.label === e.target.value,
                            );
                            if (preset) {
                              applyPreset(
                                agent.id,
                                preset.start || "",
                                preset.end || "",
                              );
                              // Reset select to default/placeholder if needed, but simple is fine
                              e.target.value = "";
                            }
                          }}
                        >
                          {SHIFT_PRESETS.map((p) => (
                            <option key={p.label} value={p.label}>
                              {p.value === "" ? "Asignar Turno..." : p.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      {weekDays.map((day) => {
                        const dateIso = format(day, "yyyy-MM-dd");
                        const dayData = schedules[agent.id]?.days[dateIso] || {
                          start: "",
                          end: "",
                        };
                        return (
                          <td
                            key={dateIso}
                            className="px-2 py-3 border-r last:border-r-0"
                          >
                            <div className="flex flex-col gap-1">
                              <input
                                type="time"
                                value={dayData.start}
                                onChange={(e) =>
                                  handleCellChange(
                                    agent.id,
                                    dateIso,
                                    "start",
                                    e.target.value,
                                  )
                                }
                                className="border rounded px-1 py-0.5 text-xs w-full focus:ring-1 focus:ring-green-500"
                              />
                              <input
                                type="time"
                                value={dayData.end}
                                onChange={(e) =>
                                  handleCellChange(
                                    agent.id,
                                    dateIso,
                                    "end",
                                    e.target.value,
                                  )
                                }
                                className="border rounded px-1 py-0.5 text-xs w-full focus:ring-1 focus:ring-green-500"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ShiftsReportTab />
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <ShiftConfigModal
          initialPresets={presets}
          onSave={handleSavePresets}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
}

// Sub-component for Config Modal
function ShiftConfigModal({
  initialPresets,
  onSave,
  onClose,
}: {
  initialPresets: Array<{
    id: string;
    label: string;
    start: string;
    end: string;
  }>;
  onSave: (
    p: Array<{
      id: string;
      label: string;
      start: string;
      end: string;
    }>,
  ) => void;
  onClose: () => void;
}) {
  const [localPresets, setLocalPresets] = useState(initialPresets);
  const [newItem, setNewItem] = useState({ label: "", start: "", end: "" });

  const handleAdd = () => {
    if (!newItem.label || !newItem.start || !newItem.end) return;
    setLocalPresets([
      ...localPresets,
      { ...newItem, id: Date.now().toString() },
    ]);
    setNewItem({ label: "", start: "", end: "" });
  };

  const handleRemove = (id: string) => {
    setLocalPresets(localPresets.filter((p) => p.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold mb-4">Configurar Tipos de Turno</h3>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {localPresets.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-gray-50 p-2 rounded border"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-gray-500">
                  {p.start} - {p.end}
                </div>
              </div>
              <button
                onClick={() => handleRemove(p.id)}
                className="p-1 hover:bg-red-100 text-red-500 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {localPresets.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              Sin turnos definidos.
            </p>
          )}
        </div>

        <div className="mt-4 border-t pt-4">
          <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">
            Agregar Nuevo
          </h4>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              placeholder="Nombre (ej. Madrugada)"
              className="border rounded px-2 py-1 text-sm col-span-2"
              value={newItem.label}
              onChange={(e) =>
                setNewItem({ ...newItem, label: e.target.value })
              }
            />
            <input
              type="time"
              className="border rounded px-2 py-1 text-sm"
              value={newItem.start}
              onChange={(e) =>
                setNewItem({ ...newItem, start: e.target.value })
              }
            />
            <input
              type="time"
              className="border rounded px-2 py-1 text-sm"
              value={newItem.end}
              onChange={(e) => setNewItem({ ...newItem, end: e.target.value })}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newItem.label || !newItem.start || !newItem.end}
            className="w-full bg-blue-50 text-blue-600 border border-blue-200 py-1 rounded text-sm hover:bg-blue-100 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Agregar a la lista
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(localPresets)}
            className="px-4 py-2 text-sm bg-sena-green text-white rounded hover:bg-green-700"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
}
