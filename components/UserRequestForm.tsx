"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Monitor,
  Cpu,
  MapPin,
  Send,
  Loader2,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import PanicButtonModal from "./PanicButtonModal"; // Importamos el modal nuevo

// Definimos la estructura del Usuario para evitar el uso de "any"
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

// Ahora usamos "User" en lugar de "any" en los props
export default function UserRequestForm({
  user,
  onCancel,
  initialLocation,
}: {
  user: User;
  onCancel: () => void;
  initialLocation?: string;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del Formulario
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
  // Cada vez que cambia la ubicación (o al inicio), verificamos si hay alertas
  useEffect(() => {
    async function checkOutages() {
      if (!location) return;

      const { data } = await supabase
        .from("mass_outages")
        .select("*")
        .eq("is_active", true)
        .eq("location_scope", location) // Busca coincidencia exacta por ubicación
        .single();

      if (data) {
        setActiveOutage(data);
      } else {
        setActiveOutage(null);
      }
    }

    // Debounce simple: esperar 500ms después de que deje de escribir para consultar
    const timer = setTimeout(() => {
      checkOutages();
    }, 500);

    return () => clearTimeout(timer);
  }, [location]);

  // 3. Enviar Ticket Normal
  const handleSubmit = async () => {
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 w-full relative">
      {/* MODAL DE PÁNICO (Se muestra si showPanicModal es true) */}
      {showPanicModal && (
        <PanicButtonModal
          user={user}
          location={location}
          onCancel={() => setShowPanicModal(false)}
          onSuccess={() => {
            setShowPanicModal(false);
            onCancel(); // Opcional: Cerrar todo el formulario tras reportar
          }}
        />
      )}

      {/* --- ALERTA DE FALLA MASIVA ACTIVA ("Efecto Waze") --- */}
      {activeOutage && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle
                className="h-5 w-5 text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-yellow-800">
                {activeOutage.title}
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                <p>{activeOutage.description}</p>
                <p className="mt-2 font-medium text-xs">
                  🔧 Los técnicos ya están trabajando en esto. No es necesario
                  crear un nuevo ticket.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CABECERA */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100 flex items-start gap-3">
        <div className="bg-sena-blue p-2 rounded-full text-white mt-1">
          <Monitor className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-sena-blue">Hola, {user.full_name}</h3>
          <p className="text-xs text-gray-600">
            Completa los datos para enviarte un técnico.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* SELECCIÓN DE CATEGORÍA */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            ¿Qué tipo de falla es?
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setCategory("HARDWARE")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                category === "HARDWARE"
                  ? "border-sena-green bg-green-50 text-sena-green shadow-md scale-105"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              <Cpu className="w-8 h-8" />
              <span className="font-bold text-sm">Equipo / Físico</span>
            </button>
            <button
              onClick={() => setCategory("SOFTWARE")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                category === "SOFTWARE"
                  ? "border-sena-green bg-green-50 text-sena-green shadow-md scale-105"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              <Monitor className="w-8 h-8" />
              <span className="font-bold text-sm">Programas / Office</span>
            </button>
          </div>
        </div>

        {/* SELECCIÓN DE ACTIVO */}
        {loading ? (
          <p className="text-xs text-gray-400">Cargando tus equipos...</p>
        ) : (
          assets.length > 0 && (
            <div className="animate-in fade-in duration-300">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                ¿Cuál equipo presenta la falla?
              </label>
              <div className="space-y-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset.serial_number)}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAsset === asset.serial_number
                        ? "border-sena-orange bg-orange-50 ring-1 ring-sena-orange"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${
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
                      <p className="text-xs text-gray-500">
                        Serial: {asset.serial_number}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* UBICACIÓN */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Ubicación Actual
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-green outline-none"
              placeholder="Ej: Bloque B, Ambiente 201"
            />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="pt-4 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!category || !location || isSubmitting}
            className="w-full bg-sena-green hover:bg-[#2d8500] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                ENVIAR SOLICITUD
                <Send className="w-5 h-5" />
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full text-gray-500 text-sm py-2 hover:text-red-500 transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>

        {/* BOTÓN DE PÁNICO (Falla Masiva) */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 mb-3">
            ¿Problemas generales de conexión?
          </p>
          <button
            onClick={() => setShowPanicModal(true)}
            className="text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 mx-auto transition-colors cursor-pointer border border-red-100"
          >
            <WifiOff className="w-3 h-3" />
            Reportar Sin Internet / Falla Masiva
          </button>
        </div>
      </div>
    </div>
  );
}
