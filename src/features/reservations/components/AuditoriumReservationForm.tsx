"use client";

import { useState, useEffect } from "react";
import { Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

import { useReservations } from "../hooks/useReservations";
import { Reservation } from "../types";

import { UserProfile } from "@/features/auth/hooks/useUserProfile";
import { Skeleton } from "@/components/Skeleton";

interface AuditoriumReservationFormProps {
  user: UserProfile["profile"];
  onCancel: () => void;
  onSuccess: () => void;
  reservationToEdit?: Reservation;
}

// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AuditoriumReservationForm({
  user,
  onCancel,
  onSuccess,
  reservationToEdit,
}: AuditoriumReservationFormProps) {
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [finalDate, setFinalDate] = useState(getLocalDateString());
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [title, setTitle] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // useReservations Hook
  const {
    reservations,
    currentUserVip,
    loading,
    createBatchReservations,
    createBatchTickets,
    syncTicketWithReservation,
  } = useReservations({
    userId: user?.id || "",
    startDate,
    finalDate: isMultiDay ? finalDate : startDate,
  });

  const [conflicts, setConflicts] = useState<Reservation[]>([]);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  // Initialize form if editing
  useEffect(() => {
    if (reservationToEdit) {
      try {
        if (!reservationToEdit.start_time || !reservationToEdit.end_time)
          return;

        const sDateObj = new Date(reservationToEdit.start_time);
        const eDateObj = new Date(reservationToEdit.end_time);

        // Get local components
        const formatDate = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };

        const formatTime = (d: Date) => {
          const h = String(d.getHours()).padStart(2, "0");
          const m = String(d.getMinutes()).padStart(2, "0");
          return `${h}:${m}`;
        };

        const sDate = formatDate(sDateObj);
        const eDate = formatDate(eDateObj);
        const sTime = formatTime(sDateObj);
        const eTime = formatTime(eDateObj);

        setStartDate(sDate);
        setFinalDate(eDate);
        setStartTime(sTime);
        setEndTime(eTime);
        setTitle(reservationToEdit.title || "");
        setSelectedResources(reservationToEdit.resources || []);
        setDescription(reservationToEdit.description || "");
        setIsMultiDay(sDate !== eDate);
      } catch (e) {
        console.error("Error parsing reservation dates:", e);
      }
    }
  }, [reservationToEdit]);

  // 2. Detectar conflictos visuales UI (Múltiples días)
  useEffect(() => {
    if (isSuccess || isSubmitting) return;
    if (!startTime || !endTime || !startDate) return;

    // Detectar conflictos en el rango de fechas
    const foundConflicts = reservations.filter((r) => {
      if (reservationToEdit && r.id === reservationToEdit.id) return false;

      const rStart = new Date(r.start_time);
      const rEnd = new Date(r.end_time);

      // Si es multi-día, debemos verificar si las HORAS chocan en CUALQUIERA de los días reservados
      // Como el backend crea una reserva por día, simplemente comparamos los intervalos de tiempo.
      // Primero, normalizamos el conflicto potencial a las mismas horas pero comparando con el rango del backend.

      const [sH, sM] = startTime.split(":").map(Number);
      const [eH, eM] = endTime.split(":").map(Number);

      // Verificamos si las horas de 'r' se solapan con las horas seleccionadas [startTime, endTime]
      const rStartHours = rStart.getHours() + rStart.getMinutes() / 60;
      const rEndHours = rEnd.getHours() + rEnd.getMinutes() / 60;
      const selectedStartHours = sH + sM / 60;
      const selectedEndHours = eH + eM / 60;

      const hoursOverlap =
        selectedStartHours < rEndHours && selectedEndHours > rStartHours;

      return hoursOverlap;
    });

    setConflicts(foundConflicts);
  }, [
    startTime,
    endTime,
    startDate,
    finalDate,
    isMultiDay,
    reservations,
    reservationToEdit,
    isSuccess,
    isSubmitting,
  ]);

  // 3. Handle Submit
  const handleSubmit = async (e?: React.FormEvent, isOverride = false) => {
    if (e) e.preventDefault();
    if (!user?.id) return;

    if (conflicts.length > 0 && !isOverride) {
      // Check if ANY conflict is from a VIP user
      const hasVipConflict = conflicts.some(
        (c) => c.users?.is_vip || c.users?.role?.toLowerCase() === "vip",
      );

      if (currentUserVip && !hasVipConflict) {
        setShowOverrideConfirm(true);
        return;
      } else {
        toast.error(
          "El horario no está disponible en las fechas seleccionadas.",
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // NOTE: We no longer manually cancel conflicts here.
      // We pass the isOverride flag to the backend to handle it atomically.

      const datesToReserve: string[] = [];
      if (isMultiDay) {
        const [sY, sM, sD] = startDate.split("-").map(Number);
        const [eY, eM, eD] = finalDate.split("-").map(Number);
        const current = new Date(sY, sM - 1, sD);
        const end = new Date(eY, eM - 1, eD);
        let safetyCounter = 0;
        while (current <= end && safetyCounter < 31) {
          datesToReserve.push(getLocalDateString(current));
          current.setDate(current.getDate() + 1);
          safetyCounter++;
        }
      } else {
        datesToReserve.push(startDate);
      }

      // Build Payload Data
      const reservationsPayload = [];
      const supportTicketsPayload = [];

      for (let i = 0; i < datesToReserve.length; i++) {
        const date = datesToReserve[i];
        const startDateObj = new Date(`${date}T${startTime}:00`);
        const endDateObj = new Date(`${date}T${endTime}:00`);
        const startIso = startDateObj.toISOString();
        const endIso = endDateObj.toISOString();

        // Target ID only for first if editing (multiday edits not fully supported yet in UI, assuming new additions)
        const targetId = i === 0 ? reservationToEdit?.id : undefined;

        reservationsPayload.push({
          id: targetId,
          title,
          start_time: startIso,
          end_time: endIso,
          user_id: user?.id || "",
          auditorium_id: "1",
          resources: selectedResources,
          description,
        });

        supportTicketsPayload.push({
          date,
          start: startTime,
          end: endTime,
          isoStart: startIso,
        });
      }

      // Execute Batch or Single
      // Note: createBatchReservations handles conflict checking atomically.
      // We accept `isOverride` to force VIP override on the server.
      await createBatchReservations(reservationsPayload, isOverride);
      setIsSuccess(true); // Mark as success immediately to prevent conflict flash

      // Handle Support Tickets (Optimized Batch)
      if (reservationToEdit && !isMultiDay) {
        // Sync Single
        const t = supportTicketsPayload[0];
        await syncTicketWithReservation(reservationToEdit.title || "", {
          title,
          date: t.date,
          start: t.start,
          end: t.end,
          resources: selectedResources,
          description,
          isoStart: t.isoStart,
        });
      } else {
        // Create Batch (New or Multi-day Edit)
        const ticketsData = supportTicketsPayload.map((t) => ({
          category: "Reserva Auditorio",
          ticket_type: "REQ" as const,
          description: `Reserva de Auditorio: ${title}\nFecha: ${t.date.split("-").reverse().join("-")}\nHora: ${t.start} - ${t.end}\nRecursos: ${selectedResources.join(", ")}\nDetalles: ${description}`,
          user_id: user?.id || "",
          location: "Auditorio",
          event_date: t.isoStart,
        }));

        await createBatchTickets(ticketsData);
      }

      toast.success("Reserva(s) confirmada(s) con éxito.");

      onSuccess();
    } catch (error: unknown) {
      setIsSuccess(false); // Reset success on error just in case
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error(`Error: ${message}`);
    } finally {
      setIsSubmitting(false);
      setShowOverrideConfirm(false);
    }
  };

  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

  return (
    <div className="max-h-[85vh] overflow-y-auto px-8 py-8 scrollbar-thin scrollbar-thumb-gray-200">
      <div className="space-y-8 pb-4">
        {/* Encabezado de Modo */}
        <div
          className={`px-5 py-4 rounded-xl border flex items-center gap-3 ${reservationToEdit ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-sena-green/10 border-sena-green/20 text-sena-green"}`}
        >
          {reservationToEdit ? (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Modo Edición</span>
                <span className="text-xs text-amber-700/80">
                  Estás modificando una reserva existente
                </span>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold text-sm">
                Nueva Reserva de Auditorio
              </span>
            </>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Título de la Actividad
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition"
            placeholder="Ej: Reunión de Equipo, Capacitación..."
          />
        </div>

        {/* Fechas */}
        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Fechas
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="multiDay"
                checked={isMultiDay}
                onChange={(e) => setIsMultiDay(e.target.checked)}
                className="w-4 h-4 text-sena-green rounded focus:ring-sena-green"
              />
              <label htmlFor="multiDay" className="text-xs text-gray-600">
                Reserva de varios días
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                min={getLocalDateString()}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!isMultiDay) setFinalDate(e.target.value);
                }}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-sena-green outline-none"
              />
            </div>
            {isMultiDay && (
              <div className="animate-in fade-in slide-in-from-left-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={finalDate}
                  min={startDate}
                  onChange={(e) => setFinalDate(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-sena-green outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Horas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Hora Inicio
            </label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition"
            >
              {timeSlots.map((hour) => (
                <option
                  key={`start-${hour}`}
                  value={`${hour.toString().padStart(2, "0")}:00`}
                >
                  {hour === 12
                    ? "12:00 PM"
                    : hour > 12
                      ? `${hour - 12}:00 PM`
                      : `${hour}:00 AM`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Hora Fin
            </label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition"
            >
              {[...timeSlots, 22].map((hour) => (
                <option
                  key={`end-${hour}`}
                  value={`${hour.toString().padStart(2, "0")}:00`}
                  disabled={hour <= parseInt(startTime.split(":")[0])}
                >
                  {hour === 12
                    ? "12:00 PM"
                    : hour > 12
                      ? `${hour - 12}:00 PM`
                      : `${hour}:00 AM`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recursos */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Recursos Necesarios
          </label>
          <div className="flex flex-wrap gap-3">
            {["Proyector", "Sonido", "Portátil"].map((resource) => (
              <label
                key={resource}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${
                  selectedResources.includes(resource)
                    ? "bg-green-50 border-sena-green text-sena-green font-medium"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedResources.includes(resource)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedResources([...selectedResources, resource]);
                    else
                      setSelectedResources(
                        selectedResources.filter((r) => r !== resource),
                      );
                  }}
                />
                {selectedResources.includes(resource) && (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                {resource}
              </label>
            ))}
          </div>
        </div>

        {/* Requerimientos Adicionales */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Requerimientos Especiales (Opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition min-h-[100px] text-sm"
            placeholder="Ej: Números de contacto, encargado, organización especial de mesas, etc..."
          />
        </div>

        {/* Disponibilidad */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-700 text-sm">Disponibilidad</h4>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-100 border border-green-300"></div>
                Libre
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-100 border border-red-300"></div>
                Ocupado
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-100 border border-blue-300"></div>
                Tu Selección
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {loading
              ? Array.from({ length: 15 }).map((_, idx) => (
                  <Skeleton
                    key={idx}
                    className="h-10 w-full rounded border border-gray-100"
                  />
                ))
              : timeSlots.map((hour) => {
                  const formatHour = (h: number) =>
                    h.toString().padStart(2, "0");
                  const slotStart = new Date(
                    `${startDate}T${formatHour(hour)}:00:00`,
                  );
                  const slotEnd = new Date(
                    `${startDate}T${formatHour(hour + 1)}:00:00`,
                  );

                  const isOccupied = reservations.some((r) => {
                    const rStart = new Date(r.start_time);
                    const rEnd = new Date(r.end_time);
                    return (
                      slotStart.getTime() < rEnd.getTime() &&
                      slotEnd.getTime() > rStart.getTime()
                    );
                  });

                  const isSelected =
                    startTime &&
                    endTime &&
                    hour >= parseInt(startTime.split(":")[0]) &&
                    hour < parseInt(endTime.split(":")[0]);

                  return (
                    <div
                      key={hour}
                      className={`p-2 rounded border text-center text-xs transition-all ${
                        isOccupied
                          ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                          : isSelected
                            ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm ring-1 ring-blue-200"
                            : "bg-white border-green-100 hover:border-green-300 text-gray-600"
                      }`}
                    >
                      {hour}:00
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Conflicto Msg */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <h4 className="font-bold text-red-700 text-sm">
                Horario No Disponible
              </h4>
              <p className="text-xs text-red-600 mt-1">
                {conflicts.length === 1 ? (
                  <>
                    Ya existe una reserva de{" "}
                    <strong>{conflicts[0].users?.full_name}</strong>.
                  </>
                ) : (
                  <>
                    Ya existen {conflicts.length} reservas en este horario
                    (Usuarios:{" "}
                    <strong>
                      {conflicts.map((c) => c.users?.full_name).join(", ")}
                    </strong>
                    ).
                  </>
                )}
                {currentUserVip && !conflicts.some((c) => c.users?.is_vip) && (
                  <span className="block mt-1 font-bold text-sena-orange">
                    Como usuario VIP, puedes tomar este horario.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting || loading || (!title && conflicts.length === 0)
            }
            className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 ${
              isSubmitting || loading || (!title && conflicts.length === 0)
                ? "bg-gray-300 cursor-not-allowed shadow-none"
                : "bg-sena-green hover:bg-green-700 hover:scale-[1.02]"
            }`}
          >
            {isSubmitting
              ? "Procesando..."
              : reservationToEdit
                ? "Guardar Cambios"
                : "Confirmar Reserva"}
          </button>
        </div>

        <ConfirmationDialog
          isOpen={showOverrideConfirm}
          onClose={() => setShowOverrideConfirm(false)}
          onConfirm={() => handleSubmit(undefined, true)}
          title="Confirmar Sobrescritura VIP"
          message={`Existen ${conflicts.length} reservas en este horario (${conflicts.map((c) => c.users?.full_name).join(", ")}). Al ser usuario VIP, puedes tomar este horario. Se cancelarán las reservas anteriores. ¿Deseas continuar?`}
          confirmText="Confirmar y Sobrescribir"
          variant="warning"
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
}
