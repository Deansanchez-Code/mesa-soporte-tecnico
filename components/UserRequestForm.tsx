"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Monitor,
  Cpu,
  MapPin,
  Send,
  Loader2,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  Activity,
} from "lucide-react";
import PanicButtonModal from "./PanicButtonModal";
import AuditoriumReservationForm from "./AuditoriumReservationForm";

interface User {
  id: string;
  full_name: string;
  area: string;
  username: string;
  role: string;
}

interface Asset {
  id: number;
  serial_number: string;
  type: string;
  brand: string;
  model: string;
}

interface Outage {
  id: number;
  title: string;
  description: string;
}

export default function UserRequestForm({
  user,
  onCancel,
  initialLocation,
  onViewChange,
}: {
  user: User;
  onCancel: () => void;
  initialLocation?: string;
  onViewChange?: (view: "SELECTION" | "TICKET" | "RESERVATION") => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // VISTA ACTUAL: 'SELECTION' | 'TICKET' | 'RESERVATION'
  const [view, setView] = useState<"SELECTION" | "TICKET" | "RESERVATION">(
    "SELECTION"
  );

  // Notificar al padre cuando cambia la vista
  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  // Estados del Formulario Ticket
  const [category, setCategory] = useState<"HARDWARE" | "SOFTWARE" | null>(
    null
  );
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [location, setLocation] = useState(initialLocation || user.area || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para el Modal de Pánico y Alertas Activas
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [activeOutage, setActiveOutage] = useState<Outage | null>(null);

  // 1. Cargar activos
  useEffect(() => {
    async function fetchAssets() {
      const { data } = await supabase
        .from("assets")
        .select("*")
        .eq("assigned_to_user_id", user.id);

      if (data) setAssets(data);
      setLoading(false);
    }
    fetchAssets();
  }, [user.id]);

  // 2. DETECTOR DE FALLAS MASIVAS ("Efecto Waze")
  useEffect(() => {
    async function checkOutages() {
      if (!location) return;

      const { data } = await supabase
        .from("mass_outages")
        .select("*")
        .eq("is_active", true)
        .eq("location_scope", location)
        .single();

      if (data) {
        setActiveOutage(data);
      } else {
        setActiveOutage(null);
      }
    }

    const timer = setTimeout(() => {
      checkOutages();
    }, 500);

    return () => clearTimeout(timer);
  }, [location]);

  // 3. Enviar Ticket Normal
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !location) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("tickets").insert({
        user_id: user.id,
        category: category,
        asset_serial: selectedAsset || null,
        location: location,
        status: "PENDIENTE",
      });

      if (error) throw error;

      alert("✅ ¡Ticket creado exitosamente! Un técnico va en camino.");
      onCancel();
    } catch (error) {
      console.error("Error creando ticket:", error);
      alert("❌ Error al crear el ticket. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- VISTA DE SELECCIÓN (CARDS) ---
  if (view === "SELECTION") {
    return (
      <div className="w-full max-w-5xl mx-auto animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            Hola, {user.full_name.split(" ")[0]}
          </h2>
          <p className="text-gray-500 mt-2">¿En qué podemos ayudarte hoy?</p>
        </div>

        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {/* CARD 1: SERVICIO TÉCNICO */}
          <button
            onClick={() => setView("TICKET")}
            className="group bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-sena-green transition-all duration-300 flex flex-col items-center text-center gap-2"
          >
            <div className="bg-green-50 p-3 rounded-full group-hover:scale-110 transition-transform duration-300">
              <Monitor className="w-8 h-8 text-sena-green" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-sena-green transition-colors">
                Servicio Técnico
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mt-1">
                Reporta fallas en equipos, internet, software o impresoras.
              </p>
            </div>
          </button>

          {/* CARD 2: RESERVA AUDITORIO */}
          <button
            onClick={() => setView("RESERVATION")}
            className="group bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-sena-blue transition-all duration-300 flex flex-col items-center text-center gap-2"
          >
            <div className="bg-blue-50 p-3 rounded-full group-hover:scale-110 transition-transform duration-300">
              <Calendar className="w-8 h-8 text-sena-blue" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-sena-blue transition-colors">
                Reserva Auditorio
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mt-1">
                Solicita el espacio para capacitaciones o eventos especiales.
              </p>
            </div>
          </button>

          {/* CARD 3: EMERGENCIA CRÍTICA */}
          <button
            onClick={() => setShowPanicModal(true)}
            className="group bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-red-500 transition-all duration-300 flex flex-col items-center text-center gap-2 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
              SOS
            </div>
            <div className="bg-red-50 p-3 rounded-full group-hover:scale-110 transition-transform duration-300 animate-pulse group-hover:animate-none">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-red-600 transition-colors">
                Emergencia Crítica
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mt-1">
                Reporte inmediato de fallas masivas de internet o urgencias.
              </p>
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 underline text-sm"
          >
            Cancelar y salir
          </button>
        </div>

        {/* Modal de Pánico (Accesible desde aquí también) */}
        {showPanicModal && (
          <PanicButtonModal
            user={user}
            location={user.area || ""}
            onCancel={() => setShowPanicModal(false)}
            onSuccess={onCancel}
          />
        )}
      </div>
    );
  }

  // --- VISTA DE FORMULARIO (WRAPPER COMÚN) ---
  return (
    <div
      className={`w-full mx-auto animate-in fade-in slide-in-from-right-8 duration-300 ${
        view === "RESERVATION" ? "max-w-6xl" : "max-w-4xl"
      }`}
    >
      <button
        onClick={() => setView("SELECTION")}
        className="mb-6 flex items-center gap-2 text-gray-500 hover:text-sena-blue transition-colors font-bold"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al menú
      </button>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* HEADER DEL FORMULARIO */}
        <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center gap-4">
          <div
            className={`p-3 rounded-full ${
              view === "TICKET"
                ? "bg-green-100 text-sena-green"
                : "bg-blue-100 text-sena-blue"
            }`}
          >
            {view === "TICKET" ? (
              <Monitor className="w-6 h-6" />
            ) : (
              <Calendar className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {view === "TICKET" ? "Servicio Técnico" : "Reservar Auditorio"}
            </h2>
            <p className="text-sm text-gray-500">
              {view === "TICKET"
                ? "Completa los detalles para asignar un técnico."
                : "Verifica disponibilidad y agenda tu evento."}
            </p>
          </div>
        </div>

        <div className="p-8">
          {view === "RESERVATION" ? (
            <AuditoriumReservationForm
              onCancel={() => setView("SELECTION")}
              onSuccess={onCancel}
            />
          ) : (
            <form onSubmit={handleSubmitTicket} className="space-y-8">
              {/* ALERTA DE FALLA MASIVA */}
              {activeOutage && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm animate-in slide-in-from-top-2">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-bold text-yellow-800">
                        {activeOutage.title}
                      </h3>
                      <p className="mt-1 text-sm text-yellow-700">
                        {activeOutage.description}
                      </p>
                      <p className="mt-2 text-xs font-bold text-yellow-800">
                        🔧 Ya estamos trabajando en ello.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SELECCIÓN DE CATEGORÍA */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  1. ¿Qué tipo de problema tienes?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setCategory("HARDWARE")}
                    className={`p-6 rounded-xl border-2 flex flex-col items-center text-center gap-4 transition-all ${
                      category === "HARDWARE"
                        ? "border-sena-green bg-green-50 ring-1 ring-sena-green"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`p-4 rounded-full ${
                        category === "HARDWARE"
                          ? "bg-white text-sena-green shadow-sm"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Cpu className="w-8 h-8" />
                    </div>
                    <div>
                      <span
                        className={`block font-bold text-lg ${
                          category === "HARDWARE"
                            ? "text-sena-green"
                            : "text-gray-700"
                        }`}
                      >
                        Equipo / Hardware
                      </span>
                      <span className="text-sm text-gray-500 mt-1 block">
                        No enciende, pantalla, teclado, mouse...
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory("SOFTWARE")}
                    className={`p-6 rounded-xl border-2 flex flex-col items-center text-center gap-4 transition-all ${
                      category === "SOFTWARE"
                        ? "border-sena-blue bg-blue-50 ring-1 ring-sena-blue"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`p-4 rounded-full ${
                        category === "SOFTWARE"
                          ? "bg-white text-sena-blue shadow-sm"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Activity className="w-8 h-8" />
                    </div>
                    <div>
                      <span
                        className={`block font-bold text-lg ${
                          category === "SOFTWARE"
                            ? "text-sena-blue"
                            : "text-gray-700"
                        }`}
                      >
                        Software / Internet
                      </span>
                      <span className="text-sm text-gray-500 mt-1 block">
                        Office, Windows, Correo, Red...
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* SELECCIÓN DE ACTIVO */}
              {assets.length > 0 && (
                <div className="animate-in fade-in duration-300">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    2. ¿Cuál equipo presenta la falla?
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset.serial_number)}
                        className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAsset === asset.serial_number
                            ? "border-sena-orange bg-orange-50 ring-1 ring-sena-orange"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                            selectedAsset === asset.serial_number
                              ? "border-sena-orange bg-sena-orange"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedAsset === asset.serial_number && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {asset.type} {asset.brand}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            SN: {asset.serial_number}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UBICACIÓN */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  3. ¿Dónde te encuentras?
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-sena-green focus:ring-4 focus:ring-green-50 outline-none transition-all font-medium text-gray-700 appearance-none bg-white"
                  >
                    <option value="">Selecciona una ubicación...</option>
                    <optgroup label="Áreas Administrativas">
                      <option value="Coordinación Académica">
                        Coordinación Académica
                      </option>
                      <option value="Administración Educativa">
                        Administración Educativa
                      </option>
                      <option value="Bienestar al Aprendiz">
                        Bienestar al Aprendiz
                      </option>
                      <option value="Biblioteca">Biblioteca</option>
                      <option value="Enfermería">Enfermería</option>
                    </optgroup>
                    <optgroup label="Ambientes de Formación">
                      <option value="Ambiente 101">Ambiente 101</option>
                      <option value="Ambiente 102">Ambiente 102</option>
                      <option value="Ambiente 201">Ambiente 201</option>
                      <option value="Ambiente 202">Ambiente 202</option>
                      <option value="Sala de Instructores">
                        Sala de Instructores
                      </option>
                    </optgroup>
                    <optgroup label="Laboratorios y Talleres">
                      <option value="Laboratorio de Software">
                        Laboratorio de Software
                      </option>
                      <option value="Laboratorio de Redes">
                        Laboratorio de Redes
                      </option>
                      <option value="Taller de Hardware">
                        Taller de Hardware
                      </option>
                    </optgroup>
                    <optgroup label="Auditorios">
                      <option value="Auditorio Principal">
                        Auditorio Principal
                      </option>
                      <option value="Sala de Conferencias">
                        Sala de Conferencias
                      </option>
                    </optgroup>
                    <optgroup label="Otras Áreas">
                      <option value="Cafetería">Cafetería</option>
                      <option value="Portería">Portería</option>
                      <option value="Zonas Comunes">Zonas Comunes</option>
                    </optgroup>
                  </select>
                  <div className="absolute right-4 top-4 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setView("SELECTION")}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!category || !location || isSubmitting}
                  className="flex-1 py-3 bg-sena-green text-white rounded-xl font-bold hover:bg-green-700 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      ENVIAR REPORTE <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
