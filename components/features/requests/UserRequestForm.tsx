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
  Search,
  Check,
  X,
} from "lucide-react";
import PanicButtonModal from "./PanicButtonModal";
import AuditoriumReservationForm from "@/components/features/reservations/AuditoriumReservationForm";

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
  location?: string;
}

interface Outage {
  id: number;
  title: string;
  description: string;
}

interface AssetCardProps {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
}

function AssetCard({ asset, selected, onSelect }: AssetCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
        selected
          ? "border-sena-orange bg-orange-50 ring-1 ring-sena-orange"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
          selected ? "border-sena-orange bg-sena-orange" : "border-gray-300"
        }`}
      >
        {selected && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">
          {asset.type} {asset.brand}
        </p>
        <p className="text-xs text-gray-500 font-mono">
          SN: {asset.serial_number}
        </p>
        {asset.location && (
          <p className="text-[10px] text-sena-blue mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {asset.location}
          </p>
        )}
      </div>
    </div>
  );
}

export default function UserRequestForm({
  user,
  onCancel,
  initialLocation,
  onViewChange,
  currentView,
}: {
  user: User;
  onCancel: () => void;
  initialLocation?: string;
  onViewChange?: (view: "SELECTION" | "TICKET" | "RESERVATION") => void;
  currentView?: "SELECTION" | "TICKET" | "RESERVATION";
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locationAssets, setLocationAssets] = useState<Asset[]>([]);

  // VISTA ACTUAL: 'SELECTION' | 'TICKET' | 'RESERVATION'
  const [view, setView] = useState<"SELECTION" | "TICKET" | "RESERVATION">(
    currentView || "SELECTION"
  );

  // Sincronizar con la prop currentView (para navegación del navegador)
  // ESTO SOLO ESCUCHA CAMBIOS DESDE ARRIBA (Padre/URL)
  useEffect(() => {
    if (currentView && currentView !== view) {
      setView(currentView);
    }
  }, [currentView, view]);

  // MANEJADOR UNIFICADO DE CAMBIO DE VISTA
  // Rompe el bucle infinito al no usar un useEffect para notificar al padre
  const handleViewChange = (
    newView: "SELECTION" | "TICKET" | "RESERVATION"
  ) => {
    // 1. Notificar al padre si es controlado
    if (onViewChange) {
      onViewChange(newView);
    }

    // 2. Actualizar localmente si NO es controlado (o para feedback inmediato optimista)
    // Nota: Si es controlado, el padre devolverá la prop y el useEffect de arriba actualizará 'view'.
    // Pero si no hay onViewChange, debemos hacerlo nosotros.
    if (!onViewChange) {
      setView(newView);
    }
  };

  // Estados del Formulario Ticket
  const [category, setCategory] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [manualSerial, setManualSerial] = useState("");
  const [suggestions, setSuggestions] = useState<Asset[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isValidSerial, setIsValidSerial] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [location, setLocation] = useState(initialLocation || user.area || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);

  const [categoryGroups, setCategoryGroups] = useState<
    Record<string, string[]>
  >({});

  // Búsqueda inteligente de seriales
  useEffect(() => {
    const searchSerial = async () => {
      if (!manualSerial) {
        setSuggestions([]);
        setIsValidSerial(false);
        setShowSuggestions(false);
        return;
      }

      // Si ya es válido (seleccionado), no buscamos de nuevo para no abrir el menú
      if (isValidSerial) return;

      setIsSearching(true);
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/assets/search?q=${encodeURIComponent(manualSerial)}`
        );
        const { data } = await response.json();

        if (data) {
          setSuggestions(data);
          setShowSuggestions(true);

          // Validar si lo que escribió ya es un match exacto
          const exactMatch = data.find(
            (a: Asset) =>
              a.serial_number.toLowerCase() === manualSerial.toLowerCase()
          );
          if (exactMatch) setIsValidSerial(true);
        }
      } catch (error) {
        console.error("Error buscando serial:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(searchSerial, 300);
    return () => clearTimeout(timeout);
  }, [manualSerial, isValidSerial]);

  // Estado para el Modal de Pánico y Alertas Activas
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [activeOutage, setActiveOutage] = useState<Outage | null>(null);

  // 1. Cargar activos y areas
  useEffect(() => {
    async function fetchData() {
      // Cargar Activos
      const { data: assetsData } = await supabase
        .from("assets")
        .select("*")
        .eq("assigned_to_user_id", user.id);

      if (assetsData) setAssets(assetsData);

      // Cargar Areas
      const { data: areasData } = await supabase
        .from("areas")
        .select("name")
        .order("name");

      if (areasData) setAreas(areasData.map((a) => a.name));

      // Cargar Categorias Dinamicas
      const { data: catData } = await supabase
        .from("ticket_categories_config")
        .select("id, user_selection_text")
        .eq("is_active", true)
        .order("user_selection_text"); // or id

      if (catData && catData.length > 0) {
        // Group by Prefix
        const groups: Record<string, string[]> = {};
        catData.forEach((item) => {
          const parts = item.user_selection_text.split(": ");
          const group = parts.length > 1 ? parts[0] : "General";

          if (!groups[group]) groups[group] = [];
          groups[group].push(item.user_selection_text);
        });
        setCategoryGroups(groups);
      } else {
        // Fallback if no seed data
        setCategoryGroups({
          General: ["HARDWARE", "SOFTWARE"],
        });
      }
    }
    fetchData();
  }, [user.id]);

  // 1b. Cargar activos de la ubicación (Dinámico)
  useEffect(() => {
    const fetchLocationAssets = async () => {
      if (!location || location.length < 3) {
        setLocationAssets([]);
        return;
      }

      const { data } = await supabase
        .from("assets")
        .select("*")
        .ilike("location", location);

      if (data) {
        // Filtrar los que ya están en 'assets' (mis asignados) para no duplicar visualmente
        const myAssetIds = new Set(assets.map((a) => a.id));
        const newAssets = data.filter((a) => !myAssetIds.has(a.id));
        setLocationAssets(newAssets);
      }
    };

    const timeout = setTimeout(fetchLocationAssets, 600); // Debounce
    return () => clearTimeout(timeout);
  }, [location, assets]);

  // EFECTO: Detectar tipo de activo para bloquear/desbloquear ubicación
  useEffect(() => {
    let currentAsset: Asset | undefined;

    // Buscar el activo seleccionado en las listas disponibles
    if (selectedAsset) {
      currentAsset =
        assets.find((a) => a.serial_number === selectedAsset) ||
        locationAssets.find((a) => a.serial_number === selectedAsset) ||
        suggestions.find((a) => a.serial_number === selectedAsset);
    } else if (isValidSerial && manualSerial) {
      currentAsset = suggestions.find((a) => a.serial_number === manualSerial);
    }

    if (currentAsset) {
      const type = currentAsset.type || "";
      // Normalizamos para quitar tildes (Portátil -> PORTATIL)
      const normalizedType = type
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

      // Si es portátil -> Desbloquear y permitir cambios
      if (
        normalizedType.includes("PORTATIL") ||
        normalizedType.includes("LAPTOP") ||
        normalizedType.includes("TABLET") ||
        normalizedType.includes("MOVIL")
      ) {
        setIsLocationLocked(false);
      } else {
        // Si es fijo (Torre, Impresora, etc.) -> Bloquear en su ubicación registrada (si tiene)
        if (currentAsset.location) {
          setLocation(currentAsset.location);
          setIsLocationLocked(true);
        } else {
          // Si no tiene ubicación registrada, dejamos libre
          setIsLocationLocked(false);
        }
      }
    } else {
      // Si no hay activo seleccionado, desbloquear para que usuario elija
      setIsLocationLocked(false);
    }
  }, [
    selectedAsset,
    isValidSerial,
    manualSerial,
    assets,
    locationAssets,
    suggestions,
  ]);

  // 2. DETECTOR DE FALLAS MASIVAS ("Efecto Waze")
  useEffect(() => {
    async function checkOutages() {
      if (!location) return;

      const { data } = await supabase
        .from("mass_outages")
        .select("*")
        .eq("is_active", true)
        .eq("location_scope", location)
        .maybeSingle();

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
        asset_serial: selectedAsset || manualSerial || null,
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
        {/* HEADER ELIMINADO: Ahora se muestra en el layout principal */}
        <div className="mb-6"></div>

        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {/* CARD 1: SERVICIO TÉCNICO */}
          <button
            onClick={() => handleViewChange("TICKET")}
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
            onClick={() => handleViewChange("RESERVATION")}
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

          {/* CARD 3: EMERGENCIA CRÍTICA (ELIMINADO POR SOLICITUD) */}
          {/* 
          <button
            onClick={() => setShowPanicModal(true)}
            className="group bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-red-500 transition-all duration-300 flex flex-col items-center text-center gap-2 relative overflow-hidden"
          >
           ...
          </button> 
          */}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors text-sm font-medium"
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
        onClick={() => handleViewChange("SELECTION")}
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
              user={user}
              onCancel={() => handleViewChange("SELECTION")}
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

              {/* SELECCIÓN DE CATEGORÍA DINÁMICA */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  1. ¿Qué tipo de problema tienes?
                </label>

                <div className="space-y-4">
                  {Object.entries(categoryGroups).map(([groupName, items]) => (
                    <div
                      key={groupName}
                      className="bg-gray-50 p-4 rounded-xl border border-gray-100"
                    >
                      <h3 className="font-bold text-gray-600 mb-3 uppercase text-xs flex items-center gap-2">
                        {groupName === "Hardware" ? (
                          <Cpu className="w-4 h-4" />
                        ) : groupName === "Software" ? (
                          <Activity className="w-4 h-4" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                        {groupName}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((itemStr) => {
                          // Extract pure label for display if formatted like "Group: Label"
                          const displayLabel = itemStr.includes(": ")
                            ? itemStr.split(": ")[1]
                            : itemStr;
                          return (
                            <button
                              key={itemStr}
                              type="button"
                              onClick={() => setCategory(itemStr)}
                              className={`p-3 rounded-lg border text-left text-sm font-medium transition-all ${
                                category === itemStr
                                  ? "border-sena-green bg-green-100 text-sena-green ring-1 ring-sena-green"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                              }`}
                            >
                              {displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SELECCIÓN DE ACTIVO */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  2. ¿Cuál equipo presenta la falla?
                </label>

                {/* MIS ACTIVOS Y ACTIVOS DE UBICACIÓN */}
                {(assets.length > 0 || locationAssets.length > 0) && (
                  <div className="mb-4 space-y-4 animate-in fade-in duration-300">
                    {assets.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                          Mis Equipos Asignados
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {assets.map((asset) => (
                            <AssetCard
                              key={asset.id}
                              asset={asset}
                              selected={selectedAsset === asset.serial_number}
                              onSelect={() => {
                                setSelectedAsset(asset.serial_number);
                                setManualSerial("");
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {locationAssets.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                          Equipos en {location}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {locationAssets.map((asset) => (
                            <AssetCard
                              key={asset.id}
                              asset={asset}
                              selected={selectedAsset === asset.serial_number}
                              onSelect={() => {
                                setSelectedAsset(asset.serial_number);
                                setManualSerial("");
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CAMPO MANUAL DE SERIAL (Búsqueda Inteligente) */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    {user.role === "contractor" || user.role === "external"
                      ? "Serial del Equipo (Obligatorio)"
                      : "Serial del Equipo (Si no aparece arriba)"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualSerial}
                      onChange={(e) => {
                        setManualSerial(e.target.value);
                        setIsValidSerial(false); // Reset validation on change
                        if (e.target.value) setSelectedAsset("");
                      }}
                      onFocus={() => {
                        if (manualSerial && suggestions.length > 0)
                          setShowSuggestions(true);
                      }}
                      onBlur={() => {
                        // Delay hide to allow click on suggestion
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      placeholder="Escribe para buscar serial..."
                      className={`w-full pl-10 pr-10 py-2 border rounded-lg outline-none focus:ring-2 transition ${
                        isValidSerial
                          ? "border-green-500 focus:ring-green-200 bg-green-50"
                          : manualSerial && !isSearching
                          ? "border-red-300 focus:ring-red-200"
                          : "border-gray-300 focus:ring-sena-green"
                      }`}
                    />
                    {/* Icono Izquierda (Search/Loader) */}
                    <div className="absolute left-3 top-2.5 text-gray-400">
                      {isSearching ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                    </div>
                    {/* Icono Derecha (Validación) */}
                    <div className="absolute right-3 top-2.5">
                      {isValidSerial ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : manualSerial && !isSearching ? (
                        <X className="w-5 h-5 text-red-400" />
                      ) : null}
                    </div>

                    {/* SUGGESTIONS DROPDOWN */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {suggestions.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              setManualSerial(asset.serial_number);
                              setIsValidSerial(true);
                              setShowSuggestions(false);
                              setSelectedAsset("");
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex flex-col border-b border-gray-100 last:border-0"
                          >
                            <span className="font-bold text-sm text-gray-800">
                              {asset.serial_number}
                            </span>
                            <span className="text-xs text-gray-500">
                              {asset.type} - {asset.brand} {asset.model}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mensajes de Ayuda/Error */}
                  <div className="mt-1 min-h-[20px]">
                    {manualSerial && !isValidSerial && !isSearching ? (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                        <X className="w-3 h-3" /> Serial no encontrado en la
                        base de datos.
                      </p>
                    ) : (user.role === "contractor" ||
                        user.role === "external") &&
                      !isValidSerial ? (
                      <p className="text-[10px] text-sena-orange font-medium">
                        * Debes seleccionar un serial válido de la lista.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* UBICACIÓN */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  3. ¿Dónde te encuentras?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                  <select
                    id="location-input"
                    value={location}
                    disabled={isLocationLocked}
                    onChange={(e) => setLocation(e.target.value)}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-green-50 outline-none transition-all font-medium text-gray-700 bg-white appearance-none cursor-pointer ${
                      !location && isSubmitting
                        ? "border-red-300"
                        : isLocationLocked
                        ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                        : "border-gray-200 focus:border-sena-green hover:border-sena-green"
                    }`}
                  >
                    <option value="">Seleccione una ubicación...</option>
                    {areas.map((area, index) => (
                      <option key={index} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>

                  {/* Icono de flecha (chevron) para indicar dropdown (opcional, pero ayuda UX) */}
                  {!isLocationLocked && (
                    <div className="absolute right-4 top-3.5 text-gray-400 pointer-events-none">
                      <svg
                        className="w-5 h-5"
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
                  )}

                  {isLocationLocked && (
                    <div
                      className="absolute right-4 top-3.5 text-gray-400"
                      title="Ubicación fija del equipo"
                    >
                      <Loader2 className="w-5 h-5 animate-spin hidden" />{" "}
                      {/* Dummy fallback */}
                      🔒
                    </div>
                  )}
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
                  disabled={
                    isSubmitting ||
                    !location ||
                    (!selectedAsset && !isValidSerial)
                  }
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 ${
                    isSubmitting ||
                    !location ||
                    (!selectedAsset && !isValidSerial)
                      ? "bg-gray-300 cursor-not-allowed shadow-none"
                      : "bg-sena-green hover:bg-green-700 hover:scale-[1.02]"
                  }`}
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
