"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar as CalendarIcon,
  AlertTriangle,
  RotateCw,
  Loader2,
  User,
} from "lucide-react";
import {
  formatDateForDB,
  getRecurrentDates,
  isHoliday,
  TimeBlock,
  TIME_BLOCKS,
} from "@/lib/scheduling";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/cliente";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  environmentId: number;
  environmentName: string;
}

export default function BulkAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  environmentId,
  environmentName,
}: Props) {
  // Form State
  const [instructorId, setInstructorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | "">("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0-6

  // Data State
  const [instructors, setInstructors] = useState<
    { id: string; full_name: string; role?: string }[]
  >([]);
  // const [loadingInstructors, setLoadingInstructors] = useState(false);

  // Validation State
  const [previewDates, setPreviewDates] = useState<Date[]>([]);
  const [holidayConflict, setHolidayConflict] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"FORM" | "CONFIRM">("FORM");

  useEffect(() => {
    if (isOpen) {
      fetchInstructors();
      setStep("FORM");
      setPreviewDates([]);
      setHolidayConflict([]);
    }
  }, [isOpen]);

  const fetchInstructors = async () => {
    try {
      // Relaxed fetch: Try to get token, but proceed without it if necessary (API supports it)
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log("Fetching instructors via API...");
      const res = await fetch("/api/instructors", { headers });
      console.log("[Client] API Status:", res.status);

      if (!res.ok) {
        let errorMsg = "Failed to fetch";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          const text = await res.text();
          console.error("[Client] Non-JSON Error Response:", text);
          errorMsg = `Error ${res.status}: ${text.substring(0, 50)}...`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      console.log("Instructors fetched (API):", data);

      if (Array.isArray(data)) {
        setInstructors(data);
      }
    } catch (error: unknown) {
      console.error("Error fetching instructors:", error);
      const msg =
        error instanceof Error ? error.message : "Error desconocido al cargar";
      toast.error("Error cargando instructores: " + msg);
    }
  };

  const handleDayToggle = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex],
    );
  };

  const calculateDates = () => {
    if (!startDate || !endDate || selectedDays.length === 0) return;

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    // Add timezone offset correction if needed, but for dates "YYYY-MM-DD" simple parse is usually enough if handled consistently.
    // However, using local time for "days of week" is safer.

    const dates = getRecurrentDates(start, end, selectedDays);
    setPreviewDates(dates);

    const conflicts = dates.filter(isHoliday);
    setHolidayConflict(conflicts);

    setStep("CONFIRM");
  };

  const handleConfirm = async (includeHolidays: boolean) => {
    if (!selectedBlock || !instructorId) return;
    setIsSubmitting(true);

    const datesToSave = includeHolidays
      ? previewDates
      : previewDates.filter((d) => !isHoliday(d));

    if (datesToSave.length === 0) {
      toast.error("No hay fechas válidas para asignar.");
      setIsSubmitting(false);
      return;
    }

    const dateStrings = datesToSave.map(formatDateForDB);

    console.log("[BulkAssignment] Attempting to save:", {
      instructorId,
      areaId: environmentId,
      selectedBlock,
      datesCount: datesToSave.length,
      dates: dateStrings,
    });

    try {
      // 2. Insert via API (Bypassing RLS)
      const res = await fetch("/api/assignments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: instructorId,
          area_id: environmentId,
          dates: dateStrings,
          time_block: selectedBlock,
        }),
      });

      const data = await res.json();
      console.log("[BulkAssignment] API Response:", {
        status: res.status,
        data,
      });

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}: Falló el servidor`);
      }

      toast.success(
        `Se crearon ${datesToSave.length} asignaciones correctamente.`,
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("[BulkAssignment] Submit Error:", err);
      toast.error("Error guardando asignaciones: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* HEADER */}
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-sena-green" />
            Asignar {environmentName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-5">
          {step === "FORM" ? (
            <>
              {/* INSTRUCTOR */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Instructor
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <select
                    value={instructorId}
                    onChange={(e) => setInstructorId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-100 border-gray-300"
                  >
                    <option value="">Seleccione un instructor...</option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RANGO DE FECHAS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-100 border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-100 border-gray-300 text-sm"
                  />
                </div>
              </div>

              {/* DIAS DE LA SEMANA */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Días a asignar
                </label>
                <div className="flex justify-between gap-1">
                  {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                    (day, index) => (
                      <button
                        key={day}
                        onClick={() => handleDayToggle(index)}
                        className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${
                          selectedDays.includes(index)
                            ? "bg-sena-green text-white shadow-md scale-105"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {day[0]}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* BLOQUE HORARIO */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bloque Horario
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TIME_BLOCKS) as TimeBlock[]).map((blockKey) => (
                    <button
                      key={blockKey}
                      onClick={() => setSelectedBlock(blockKey)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        selectedBlock === blockKey
                          ? "border-sena-green bg-green-50 text-sena-green ring-1 ring-sena-green"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="font-bold text-sm">
                        {TIME_BLOCKS[blockKey].label}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {TIME_BLOCKS[blockKey].range}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ACTIONS */}
              <button
                disabled={
                  !instructorId ||
                  !startDate ||
                  !endDate ||
                  !selectedBlock ||
                  selectedDays.length === 0
                }
                onClick={calculateDates}
                className="w-full bg-sena-green text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/10 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
              >
                Validar Fechas
              </button>
            </>
          ) : (
            // CONFIRMATION STEP
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
                <CalendarIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-blue-800 text-sm">
                    Resumen de Asignación
                  </h4>
                  <p className="text-xs text-blue-600 mt-1">
                    Se intentarán asignar{" "}
                    <strong>{previewDates.length} días</strong> para el bloque{" "}
                    <strong>{selectedBlock}</strong>.
                  </p>
                </div>
              </div>

              {holidayConflict.length > 0 && (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-bold text-orange-800">
                        ¡Atención! Hay {holidayConflict.length} días festivos
                      </h3>
                      <p className="mt-1 text-xs text-orange-700">
                        El rango seleccionado incluye festivos (ej:{" "}
                        {formatDateForDB(holidayConflict[0])}).
                      </p>
                      <p className="mt-2 text-xs font-bold text-orange-800">
                        ¿Deseas asignar turno también en festivos?
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep("FORM")}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-600 font-bold hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Atrás
                </button>

                {holidayConflict.length > 0 ? (
                  <>
                    <button
                      onClick={() => handleConfirm(false)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700 text-xs"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      ) : (
                        "Saltar Festivos"
                      )}
                    </button>
                    <button
                      onClick={() => handleConfirm(true)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-sena-green text-white rounded-xl font-bold hover:bg-green-700 text-xs"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      ) : (
                        "Incluir Todo"
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConfirm(true)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-sena-green text-white rounded-xl font-bold hover:bg-green-700"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Confirmar Asignación"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
