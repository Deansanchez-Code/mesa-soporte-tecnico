"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface Reservation {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: "APPROVED" | "CANCELLED";
  user_id: string;
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
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [finalDate, setFinalDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Cargar reservas y verificar VIP (Basado en startDate para la visualización)
  useEffect(() => {
    const fetchReservations = async () => {
      // Traer reservas del día seleccionado (y activos)
      const startOfDay = `${startDate}T00:00:00`;
      const endOfDay = `${startDate}T23:59:59`;

      const { data } = await supabase
        .from("reservations")
        .select("*, users(full_name, is_vip)")
        .eq("status", "APPROVED")
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay)
        .order("start_time");

      if (data) setReservations(data as unknown as Reservation[]);
    };

    const checkVipStatus = async () => {
      if (!user?.id) return;
      const { data: dbUser } = await supabase
        .from("users")
        .select("is_vip")
        .eq("id", user.id)
        .single();

      if (dbUser) setCurrentUserVip(dbUser.is_vip);
    };

    fetchReservations();
    checkVipStatus();
  }, [startDate, user.id]);

  // Detectar conflictos en tiempo real (Solo para el día visualizado - startDate)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.id) return;
    setLoading(true);

    try {
      // Generar lista de fechas a reservar
      const datesToReserve: string[] = [];
      if (isMultiDay) {
        const current = new Date(startDate);
        const end = new Date(finalDate);
        while (current <= end) {
          datesToReserve.push(current.toISOString().split("T")[0]);
          current.setDate(current.getDate() + 1);
        }
      } else {
        datesToReserve.push(startDate);
      }

      // Validar conflictos para TODAS las fechas
      // Esto requiere consultar al backend por cada fecha o un rango amplio
      // Para simplificar y ser robusto, haremos un chequeo previo
      for (const date of datesToReserve) {
        const startIso = `${date}T${startTime}:00`;
        const endIso = `${date}T${endTime}:00`;

        const { data: conflicts } = await supabase
          .from("reservations")
          .select("*, users(full_name, is_vip)")
          .eq("status", "APPROVED")
          .lt("start_time", endIso)
          .gt("end_time", startIso);

        if (conflicts && conflicts.length > 0) {
          // Si hay conflicto
          const conflict = conflicts[0] as unknown as Reservation;
          // Lógica VIP Override (Solo si es un solo día o si queremos soportarlo en multi-día complejo)
          // Para multi-día, si hay conflicto, bloqueamos por ahora para no complicar la UI de confirmación múltiple
          if (isMultiDay) {
            alert(
              `Conflicto el día ${date} con ${conflict.users?.full_name}. No se puede realizar la reserva masiva.`
            );
            setLoading(false);
            return;
          } else {
            // Lógica existente para un solo día
            if (currentUserVip && !conflict.users?.is_vip) {
              const confirmOverride = window.confirm(
                `Existe una reserva de ${conflict.users?.full_name}. Al ser usuario VIP, puedes tomar este horario. Se cancelará la reserva anterior. ¿Deseas continuar?`
              );
              if (!confirmOverride) {
                setLoading(false);
                return;
              }
              await supabase
                .from("reservations")
                .update({ status: "CANCELLED" })
                .eq("id", conflict.id);
            } else {
              alert("El horario seleccionado no está disponible.");
              setLoading(false);
              return;
            }
          }
        }
      }

      // Crear reservas
      for (const date of datesToReserve) {
        const startIso = `${date}T${startTime}:00`;
        const endIso = `${date}T${endTime}:00`;

        const { error } = await supabase.from("reservations").insert([
          {
            auditorium_id: "1",
            title,
            start_time: startIso,
            end_time: endIso,
            user_id: user.id,
            resources: selectedResources,
          },
        ]);

        if (error) throw error;

        // CREAR TICKET AUTOMÁTICO
        const description = `Reserva de Auditorio: ${title}\nFecha: ${date}\nHora: ${startTime} - ${endTime}\nRecursos: ${selectedResources.join(
          ", "
        )}`;

        const { error: ticketError } = await supabase.from("tickets").insert([
          {
            category: "Reserva Auditorio",
            status: "PENDING",
            location: "Auditorio",
            description: description,
            user_id: user.id,
          },
        ]);

        if (ticketError) {
          console.error("Error creando ticket de reserva:", ticketError);
          // No lanzamos error para no bloquear la reserva, pero logueamos
        }
      }

      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Error al crear la reserva.");
    } finally {
      setLoading(false);
    }
  };

  // Generar bloques de tiempo para visualización
  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6); // 6 to 21

  return (
    <div className="space-y-6">
      {/* Título de la Reserva */}
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

      {/* Selección de Fechas (Multi-día) */}
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
              min={new Date().toISOString().split("T")[0]}
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

      {/* Selección de Hora */}
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

      {/* Recursos Necesarios */}
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
                  if (e.target.checked) {
                    setSelectedResources([...selectedResources, resource]);
                  } else {
                    setSelectedResources(
                      selectedResources.filter((r) => r !== resource)
                    );
                  }
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

      {/* Visualización de Disponibilidad (Solo para startDate) */}
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

        {/* Leyenda de Horarios */}
        <div className="flex gap-4 mb-2 text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
          <span className="flex items-center gap-1 font-medium text-blue-700">
            <div className="w-2 h-2 rounded-full bg-blue-200"></div>
            Atención Agente (7am - 9pm)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
            Horario Extendido (Sin Agente)
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {timeSlots.map((hour) => {
            const slotStart = new Date(`${startDate}T${hour}:00:00`);
            const slotEnd = new Date(`${startDate}T${hour + 1}:00:00`);

            // Verificar si está ocupado
            const isOccupied = reservations.some((r) => {
              const rStart = new Date(r.start_time);
              const rEnd = new Date(r.end_time);
              return slotStart < rEnd && slotEnd > rStart;
            });

            // Verificar si es la selección actual
            const isSelected =
              startTime &&
              endTime &&
              hour >= parseInt(startTime.split(":")[0]) &&
              hour < parseInt(endTime.split(":")[0]);

            // Verificar si es horario de agente (7-21, o configurable)
            // Aquí hardcodeamos 7-21 como horario de agente para el ejemplo visual
            // En realidad el array timeSlots ya es 7-21.
            // Si quisiéramos mostrar 6-22, tendríamos que ajustar timeSlots.
            // Asumamos que timeSlots es el rango total visible.
            const isAgentHour = hour >= 7 && hour < 21;

            return (
              <div
                key={hour}
                className={`
                  p-2 rounded border text-center text-xs transition-all
                  ${
                    isOccupied
                      ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm ring-1 ring-blue-200"
                      : isAgentHour
                      ? "bg-white border-green-100 hover:border-green-300 text-gray-600"
                      : "bg-gray-50 border-gray-100 text-gray-400"
                  }
                `}
              >
                {hour}:00
              </div>
            );
          })}
        </div>
      </div>

      {/* Mensaje de Conflicto */}
      {conflict && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <h4 className="font-bold text-red-700 text-sm">
              Horario No Disponible
            </h4>
            <p className="text-xs text-red-600 mt-1">
              Ya existe una reserva de{" "}
              <strong>{conflict.users?.full_name}</strong> en este horario.
              {currentUserVip && !conflict.users?.is_vip && (
                <span className="block mt-1 font-bold text-sena-orange">
                  Como usuario VIP, puedes tomar este horario.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Política */}
      <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <h4 className="font-bold text-blue-800 text-sm">
            Política de Reservas
          </h4>
          <p className="text-xs text-blue-600 mt-1">
            • Horario disponible: 06:00 AM - 10:00 PM.
            <br />
            • Las reservas se aprueban automáticamente.
            <br />• <strong>Usuarios VIP</strong> tienen prioridad sobre
            reservas estándar.
          </p>
        </div>
      </div>

      {/* Botones de Acción */}
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
