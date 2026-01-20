"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Calendar, AlertTriangle, CheckCircle } from "lucide-react";

interface Reservation {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: "APPROVED" | "CANCELLED";
  user_id: string;
  auditorium_id?: string;
  resources?: string[];
  users?: {
    full_name: string;
    is_vip: boolean;
  };
}

interface AuditoriumReservationFormProps {
  user: { id: string; full_name: string };
  onCancel: () => void;
  onSuccess: () => void;
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
}: AuditoriumReservationFormProps) {
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [title, setTitle] = useState("");
  const [conflict, setConflict] = useState<Reservation | null>(null);
  const [currentUserVip, setCurrentUserVip] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  // Use local date to avoid UTC shifts
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [finalDate, setFinalDate] = useState(getLocalDateString());

  const [isMultiDay, setIsMultiDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Helper function to get token
  const getAuthToken = async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // 1. Cargar reservas (SELECT funciona porque RLS permite lectura anonima o authenticated para disponibilidad)
  useEffect(() => {
    const fetchReservations = async () => {
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
        console.error("Error fetching reservations:", error);
        return;
      }
      if (data) setReservations(data as unknown as Reservation[]);
    };

    // Check VIP status (optional since we rely on backend mainly, but good for UI feedback)
    const checkVipStatus = async () => {
      if (!user?.id) return;
      const { data: dbUser } = await supabase
        .from("users")
        .select("is_vip")
        .eq("id", user.id)
        .maybeSingle();

      if (dbUser) setCurrentUserVip(dbUser.is_vip);
    };

    fetchReservations();
    checkVipStatus();
  }, [startDate, user.id]);

  // 2. Detectar conflictos visuales UI
  useEffect(() => {
    if (!startTime || !endTime || !startDate) return;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);

    const found = reservations.find((r) => {
      const rStart = new Date(r.start_time);
      const rEnd = new Date(r.end_time);
      return start < rEnd && end > rStart;
    });
    setConflict(found || null);
  }, [startTime, endTime, startDate, reservations]);

  // 3. Handle Submit via API Routes (Bypassing RLS Write Restrictions)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.id) return;
    setLoading(true);

    try {
      // Obtener token una sola vez al inicio
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error(
          "No se pudo obtener el token de autenticación. Por favor, inicia sesión nuevamente.",
        );
      }

      const datesToReserve: string[] = [];
      if (isMultiDay) {
        const current = new Date(startDate);
        const end = new Date(finalDate);
        let safetyCounter = 0;
        while (current <= end && safetyCounter < 31) {
          datesToReserve.push(getLocalDateString(current));
          current.setDate(current.getDate() + 1);
          safetyCounter++;
        }
      } else {
        datesToReserve.push(startDate);
      }

      // Proceso de Reserva por fecha
      for (const date of datesToReserve) {
        // Crear fechas completas y convertirlas a ISO string (UTC) para pasar validación Zod
        const startDateObj = new Date(`${date}T${startTime}:00`);
        const endDateObj = new Date(`${date}T${endTime}:00`);

        const startIso = startDateObj.toISOString();
        const endIso = endDateObj.toISOString();

        // Check conflicts again (robustness)
        // (Simplified logic: trusting UI conflict state for single day, or skipped for multiday)
        // Ideally we should call a check API, but we'll let the create API fail or we handle the override.

        // VIP Override Logic using API
        if (conflict && !isMultiDay) {
          // We reuse 'conflict' state from current view
          // Assuming the conflict is exactly the one we see
          if (currentUserVip && !conflict.users?.is_vip) {
            const confirmOverride = window.confirm(
              `Existe una reserva de ${conflict.users?.full_name}. Al ser usuario VIP, puedes tomar este horario. Se cancelará la reserva anterior. ¿Deseas continuar?`,
            );
            if (!confirmOverride) {
              setLoading(false);
              return;
            }

            // Cancel via API
            const cancelRes = await fetch("/api/reservations/cancel", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ reservation_id: conflict.id }),
            });

            if (!cancelRes.ok)
              throw new Error("Error al cancelar la reserva existente.");
          } else {
            alert("El horario no está disponible.");
            setLoading(false);
            return;
          }
        }

        // Create Reservation via API
        const createRes = await fetch("/api/reservations/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title,
            start_time: startIso,
            end_time: endIso,
            user_id: user.id,
            auditorium_id: "1",
            resources: selectedResources,
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json();
          throw new Error(errData.error || "Falló la creación de la reserva");
        }

        // Create Ticket via API
        const description = `Reserva de Auditorio: ${title}\nFecha: ${date}\nHora: ${startTime} - ${endTime}\nRecursos: ${selectedResources.join(
          ", ",
        )}`;

        // Non-blocking ticket creation (optional: blocking)
        await fetch("/api/tickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            category: "Reserva Auditorio",
            ticket_type: "REQ",
            description,
            user_id: user.id,
            location: "Auditorio",
            asset_serial: null, // Not tied to asset
          }),
        });
      }

      alert("✅ Reserva(s) confirmada(s) con éxito.");
      onSuccess();
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      alert(`❌ Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6); // 6 to 21

  return (
    <div className="space-y-6">
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
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
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
                {hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
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
                {hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
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
          {timeSlots.map((hour) => {
            const formatHour = (h: number) => h.toString().padStart(2, "0");
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
            const isAgentHour = hour >= 7 && hour < 21;

            return (
              <div
                key={hour}
                className={`p-2 rounded border text-center text-xs transition-all ${
                  isOccupied
                    ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                    : isSelected
                      ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm ring-1 ring-blue-200"
                      : isAgentHour
                        ? "bg-white border-green-100 hover:border-green-300 text-gray-600"
                        : "bg-gray-50 border-gray-100 text-gray-400"
                }`}
              >
                {hour}:00
              </div>
            );
          })}
        </div>
      </div>

      {/* Conflicto Msg */}
      {conflict && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <h4 className="font-bold text-red-700 text-sm">
              Horario No Disponible
            </h4>
            <p className="text-xs text-red-600 mt-1">
              Ya existe una reserva de{" "}
              <strong>{conflict.users?.full_name}</strong>.
              {currentUserVip && !conflict.users?.is_vip && (
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
          disabled={loading || (!title && !conflict)}
          className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 ${
            loading || (!title && !conflict)
              ? "bg-gray-300 cursor-not-allowed shadow-none"
              : "bg-sena-green hover:bg-green-700 hover:scale-[1.02]"
          }`}
        >
          {loading ? "Procesando..." : "Confirmar Reserva"}
        </button>
      </div>
    </div>
  );
}
