"use client";

import { useEffect, useState } from "react";
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
  CalendarRange,
} from "lucide-react";
import PanicButtonModal from "./PanicButtonModal";
import AuditoriumReservationForm from "@/components/features/reservations/AuditoriumReservationForm";
import AssignmentManager from "@/components/features/assignments/AssignmentManager";
import { useTicketRequest } from "./hooks/useTicketRequest";
import { User, Asset } from "./types";

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
  onViewChange?: (
    view: "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY",
  ) => void;
  currentView?: "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY";
}) {
  // Use the new custom hook
  const {
    // Data
    assets,
    locationAssets,
    areas,
    categoryGroups,
    activeOutage,

    // Form State
    category,
    setCategory,
    selectedAsset,
    setSelectedAsset,
    manualSerial,
    setManualSerial,
    location,
    setLocation,
    isSubmitting,
    isLocationLocked,

    // Search / Validation
    showSuggestions,
    setShowSuggestions,
    suggestions,
    isValidSerial,
    setIsValidSerial,
    isSearching,

    // Handlers
    handleSubmitTicket,
  } = useTicketRequest({
    user,
    initialLocation,
    onSuccess: onCancel,
  });

  // VISTA ACTUAL: 'SELECTION' | 'TICKET' | 'RESERVATION' | 'AVAILABILITY'
  const [view, setView] = useState<
    "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY"
  >(currentView || "SELECTION");

  // Sincronizar con la prop currentView
  useEffect(() => {
    if (currentView && currentView !== view) {
      setView(currentView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const handleViewChange = (
    newView: "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY",
  ) => {
    if (onViewChange) {
      onViewChange(newView);
    }
    if (!onViewChange) {
      setView(newView);
    }
  };

  const [showPanicModal, setShowPanicModal] = useState(false);

  // --- VISTA DE SELECCIÓN (CARDS) ---
  if (view === "SELECTION") {
    return (
      <div className="w-full max-w-5xl mx-auto animate-in fade-in zoom-in duration-300">
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

          {/* CARD 3: CONSULTAR DISPONIBILIDAD */}
          <button
            onClick={() => handleViewChange("AVAILABILITY")}
            className="group bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-purple-500 transition-all duration-300 flex flex-col items-center text-center gap-2"
          >
            <div className="bg-purple-50 p-3 rounded-full group-hover:scale-110 transition-transform duration-300">
              <CalendarRange className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                Consultar Disponibilidad
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mt-1">
                Verifica la ocupación de ambientes y programación de
                instructores.
              </p>
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            Cancelar y salir
          </button>
        </div>

        {/* Modal de Pánico */}
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
        view === "RESERVATION" || view === "AVAILABILITY"
          ? "max-w-6xl"
          : "max-w-4xl"
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
                : view === "RESERVATION"
                  ? "bg-blue-100 text-sena-blue"
                  : "bg-purple-100 text-purple-600"
            }`}
          >
            {view === "TICKET" ? (
              <Monitor className="w-6 h-6" />
            ) : view === "RESERVATION" ? (
              <Calendar className="w-6 h-6" />
            ) : (
              <CalendarRange className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {view === "TICKET"
                ? "Servicio Técnico"
                : view === "RESERVATION"
                  ? "Reservar Auditorio"
                  : "Disponibilidad de Ambientes"}
            </h2>
            <p className="text-sm text-gray-500">
              {view === "TICKET"
                ? "Completa los detalles para asignar un técnico."
                : view === "RESERVATION"
                  ? "Verifica disponibilidad y agenda tu evento."
                  : "Consulta y gestión de asignaciones de instructores."}
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
          ) : view === "AVAILABILITY" ? (
            <div className="min-h-[600px]">
              <AssignmentManager
                canManage={
                  user.role === "admin" ||
                  user.role === "superadmin" ||
                  user.role === "coordinator" ||
                  !!user.perm_manage_assignments
                }
              />
            </div>
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

                {/* CAMPO MANUAL DE SERIAL */}
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
                        setIsValidSerial(false);
                        if (e.target.value) setSelectedAsset("");
                      }}
                      onFocus={() => {
                        if (manualSerial && suggestions.length > 0)
                          setShowSuggestions(true);
                      }}
                      onBlur={() => {
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
                    <div className="absolute left-3 top-2.5 text-gray-400">
                      {isSearching ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                    </div>
                    <div className="absolute right-3 top-2.5">
                      {isValidSerial ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : manualSerial && !isSearching ? (
                        <X className="w-5 h-5 text-red-400" />
                      ) : null}
                    </div>

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

                  <div className="mt-1 min-h-[20px]">
                    {manualSerial && !isValidSerial && !isSearching ? (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                        <X className="w-3 h-3" /> Serial no encontrado en la
                        base de datos.
                      </p>
                    ) : user.employment_type === "planta" &&
                      !isValidSerial &&
                      !selectedAsset ? (
                      <p className="text-[10px] text-sena-orange font-medium animate-pulse">
                        * Funcionarios de planta deben seleccionar un equipo
                        SENA asignado.
                      </p>
                    ) : (user.role === "contractor" ||
                        user.role === "external") &&
                      !isValidSerial &&
                      !selectedAsset ? (
                      <p className="text-[10px] text-gray-400">
                        * Opcional: Ingrese el serial si el equipo es SENA.
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
                      <Loader2 className="w-5 h-5 animate-spin hidden" /> 🔒
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
                    (user.employment_type === "planta" &&
                      !selectedAsset &&
                      !isValidSerial)
                  }
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 ${
                    isSubmitting ||
                    !location ||
                    (user.employment_type === "planta" &&
                      !selectedAsset &&
                      !isValidSerial)
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-sena-green hover:bg-[#2d8500] hover:scale-105"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      ENVIAR SOLICITUD <Send className="w-4 h-4" />
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
