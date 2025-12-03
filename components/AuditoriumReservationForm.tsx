"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { safeGetItem } from "@/lib/storage";
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
  onCancel: () => void;
  onSuccess: () => void;
}

export default function AuditoriumReservationForm({
  onCancel,
  onSuccess,
}: AuditoriumReservationFormProps) {
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [title, setTitle] = useState("");
  const [conflict, setConflict] = useState<Reservation | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    is_vip: boolean;
  } | null>(null);

  // Cargar usuario y reservas
  useEffect(() => {
    const fetchReservations = async () => {
      // Traer reservas del día seleccionado (y activos)
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;

      const { data } = await supabase
        .from("reservations")
        .select("*, users(full_name, is_vip)")
        .eq("status", "APPROVED")
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay)
        .order("start_time");

      if (data) setReservations(data as unknown as Reservation[]);
    };

    const loadData = async () => {
      const userStr = safeGetItem("tic_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        // Recargar usuario de DB para asegurar status VIP actualizado
        const { data: dbUser } = await supabase
          .from("users")
          .select("id, is_vip")
          .eq("id", user.id)
          .single();

        if (dbUser) setCurrentUser(dbUser);
      }
      fetchReservations();
    };
    loadData();
  }, [selectedDate]);

  // Detectar conflictos en tiempo real
  useEffect(() => {
    if (!startTime || !endTime || !selectedDate) return;

    const start = new Date(`${selectedDate}T${startTime}`);
    const end = new Date(`${selectedDate}T${endTime}`);

    const found = reservations.find((r) => {
      const rStart = new Date(r.start_time);
      const rEnd = new Date(r.end_time);
      // Lógica de superposición
      return start < rEnd && end > rStart;
    });

    setConflict(found || null);
  }, [startTime, endTime, selectedDate, reservations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    try {
      const startIso = `${selectedDate}T${startTime}:00`;
      const endIso = `${selectedDate}T${endTime}:00`;

      // 1. Si hay conflicto
      if (conflict) {
        // Si soy VIP y el conflicto NO es VIP -> Override
        if (currentUser.is_vip && !conflict.users?.is_vip) {
          const confirmOverride = window.confirm(
            `Existe una reserva de ${conflict.users?.full_name}. Al ser usuario VIP, puedes tomar este horario. Se cancelará la reserva anterior. ¿Deseas continuar?`
          );
          if (!confirmOverride) {
            setLoading(false);
            return;
          }

          // Cancelar la otra reserva
          await supabase
            .from("reservations")
            .update({ status: "CANCELLED" })
            .eq("id", conflict.id);
        } else {
          // Si no soy VIP o el conflicto ES VIP -> Error
          alert("El horario seleccionado no está disponible.");
          setLoading(false);
          return;
        }
      }

      // 2. Crear mi reserva
      const { error } = await supabase.from("reservations").insert({
        user_id: currentUser.id,
        title,
        start_time: startIso,
        end_time: endIso,
        status: "APPROVED", // Auto-aprobación
      });

      if (error) throw error;

      alert("Reserva creada exitosamente.");
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Error al crear la reserva.");
    } finally {
      setLoading(false);
    }
  };

  // Generar bloques de tiempo para visualización
  const timeSlots = Array.from({ length: 15 }, (_, i) => i + 7); // 7 to 21

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <h4 className="font-bold text-blue-800 text-sm">
            Política de Reservas
          </h4>
          <p className="text-xs text-blue-600 mt-1">
            • Horario disponible: 07:00 AM - 09:00 PM.
            <br />
            • Las reservas se aprueban automáticamente.
            <br />• <strong>Usuarios VIP</strong> tienen prioridad sobre
            reservas estándar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUMNA 1: FORMULARIO */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Nombre del Evento
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2"
              placeholder="Ej: Capacitación de Seguridad"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Fecha
            </label>
            <input
              required
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Inicio
              </label>
              <input
                required
                type="time"
                min="07:00"
                max="21:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Fin
              </label>
              <input
                required
                type="time"
                min={startTime}
                max="21:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
          </div>

          {/* CONFLICT WARNING */}
          {conflict && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-3 ${
                currentUser?.is_vip && !conflict.users?.is_vip
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
              <div className="text-xs">
                <p className="font-bold">Horario Ocupado</p>
                <p>
                  Reservado por: <strong>{conflict.users?.full_name}</strong>
                </p>
                {currentUser?.is_vip && !conflict.users?.is_vip && (
                  <p className="mt-1 font-bold underline">
                    Como VIP, puedes tomar este lugar.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-bold text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                (!!conflict && (!currentUser?.is_vip || conflict.users?.is_vip))
              }
              className="flex-1 py-2 bg-sena-green text-white rounded-lg hover:bg-green-700 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando..." : "Confirmar Reserva"}
            </button>
          </div>
        </form>

        {/* COLUMNA 2: VISUALIZACIÓN */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 h-fit max-h-[400px] overflow-y-auto">
          <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Disponibilidad ({selectedDate})
          </h4>
          <div className="space-y-1">
            {timeSlots.map((hour) => {
              const hourStr = `${hour.toString().padStart(2, "0")}:00`;
              // Buscar si hay reserva en esta hora
              const res = reservations.find((r) => {
                const startH = new Date(r.start_time).getHours();
                const endH = new Date(r.end_time).getHours();
                // Simple check: si la hora está dentro del rango
                return hour >= startH && hour < endH;
              });

              return (
                <div
                  key={hour}
                  className={`text-xs p-2 rounded flex justify-between items-center ${
                    res
                      ? res.users?.is_vip
                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                      : "bg-white text-gray-500 border border-gray-100"
                  }`}
                >
                  <span className="font-mono">{hourStr}</span>
                  {res ? (
                    <span className="font-bold truncate max-w-[120px]">
                      {res.title} ({res.users?.full_name})
                    </span>
                  ) : (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Libre
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
