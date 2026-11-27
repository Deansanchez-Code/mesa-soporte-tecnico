"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ConfigItem, User } from "@/app/admin/admin.types";
import {
  disableSpaceMaintenanceAction,
  getAllSpacesMaintenanceAction,
  saveSpaceMaintenanceAction,
} from "@/features/reservations/actions/spaceMaintenanceActions";
import {
  assignSpaceCoordinatorAction,
  getEnvironmentsGlobalConfigAction,
  saveEnvironmentsTabOrderAction,
  toggleSpaceStatusBySuperAdminAction,
} from "@/features/reservations/actions/spaceConfigActions";
import {
  AssignableUser,
  getAssignableUsersAction,
} from "@/features/reservations/actions/assignmentAdminActions";
import { DEFAULT_SPACE_COORDINATORS } from "@/features/reservations/constants";
import { SPECIAL_SPACES_CATALOG } from "@/features/reservations/services/maintenanceService";
import {
  EnvironmentsGlobalConfig,
  SpaceMaintenanceConfig,
} from "@/features/reservations/types";
import { NativeDialog } from "@/components/ui/NativeDialog";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  Loader2,
  MapPin,
  Pencil,
  Power,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
} from "lucide-react";

interface AdminSpacesTabProps {
  currentUser: User | null;
  areas: ConfigItem[];
  categories: ConfigItem[];
  usersList: User[];
  onRefreshConfig: () => void;
}

export default function AdminSpacesTab({
  currentUser,
  areas,
  categories,
  usersList,
  onRefreshConfig,
}: AdminSpacesTabProps) {
  const [newConfigItem, setNewConfigItem] = useState("");
  const [maintenanceConfig, setMaintenanceConfig] =
    useState<SpaceMaintenanceConfig>({
      is_active: false,
      space_id: "1",
      space_name: "Auditorio 103",
      start_date: "2026-09-01",
      end_date: null,
      custom_title: "Auditorio 103 en Remodelación",
      custom_message: "",
    });
  const [spacesMaintenanceMap, setSpacesMaintenanceMap] = useState<
    Record<string, SpaceMaintenanceConfig>
  >({});
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [togglingSpaceKey, setTogglingSpaceKey] = useState<string | null>(null);
  const [envGlobalConfig, setEnvGlobalConfig] =
    useState<EnvironmentsGlobalConfig>({
      tab_order: [],
      disabled_area_ids: [],
      disabled_special_spaces: [],
      coordinators: {},
    });

  const [assignableStaffUsers, setAssignableStaffUsers] = useState<
    AssignableUser[]
  >([]);
  const [isLoadingAssignableUsers, setIsLoadingAssignableUsers] =
    useState(false);
  const [selectedSpaceForCoord, setSelectedSpaceForCoord] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedCoordUserId, setSelectedCoordUserId] = useState("");
  const [isAssigningCoord, setIsAssigningCoord] = useState(false);
  const [coordSearchQuery, setCoordSearchQuery] = useState("");

  useEffect(() => {
    getAllSpacesMaintenanceAction()
      .then((res) => {
        if (res?.configs) {
          setSpacesMaintenanceMap(res.configs);
          if (res.configs["1"]) {
            setMaintenanceConfig(res.configs["1"]);
          }
        }
      })
      .catch(() => {});

    getEnvironmentsGlobalConfigAction()
      .then((res) => {
        if (res?.config) {
          setEnvGlobalConfig(res.config);
        }
      })
      .catch(() => {});

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setIsLoadingAssignableUsers(true);
        getAssignableUsersAction(data.session?.access_token)
          .then((res) => {
            if (res?.success && res.users) {
              setAssignableStaffUsers(res.users);
            }
          })
          .catch(() => {})
          .finally(() => setIsLoadingAssignableUsers(false));
      })
      .catch(() => setIsLoadingAssignableUsers(false));
  }, []);

  const availableMaintenanceSpaces = useMemo(() => {
    const special = SPECIAL_SPACES_CATALOG.map((s) => ({
      id: s.id,
      name: s.name,
      group: "Espacios de Reserva Institucional",
    }));
    const extraAreas = areas
      .filter((a) => {
        const up = a.name.toUpperCase();
        return (
          (up.includes("AMBIENTE") ||
            up.includes("AUDITORIO") ||
            up.includes("SUBDIRECCIÓN") ||
            up.includes("BIBLIOTECA") ||
            up.includes("COCINA")) &&
          !up.includes("KIOSKO") &&
          !up.includes("INSTRUCTORES") &&
          !up.includes("AUDITORIO") &&
          !up.includes("SUBDIRECCIÓN") &&
          !up.includes("BIBLIOTECA") &&
          !up.includes("107") &&
          !up.includes("COCINA")
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: `area:${a.id}`,
        name: a.name,
        group: "Ambientes de Formación (Calendario)",
      }));
    return { special, extraAreas, all: [...special, ...extraAreas] };
  }, [areas]);

  const pausedSpacesList = useMemo(
    () =>
      Object.values(spacesMaintenanceMap)
        .filter((cfg) => Boolean(cfg?.is_active))
        .sort((a, b) =>
          (a.space_name || a.space_id).localeCompare(
            b.space_name || b.space_id,
          ),
        ),
    [spacesMaintenanceMap],
  );

  const coordinatorCandidateUsers = useMemo(() => {
    const baseList: AssignableUser[] =
      assignableStaffUsers.length > 0
        ? assignableStaffUsers
        : usersList
            .filter((u) => u.is_active !== false)
            .map((u) => ({
              id: u.id,
              full_name: u.full_name,
              username: u.username || (u.email ? u.email.split("@")[0] : ""),
              email: u.email,
              role: u.role,
              job_category: u.job_category || null,
              employment_type: u.employment_type || null,
              area: u.area || null,
              is_vip: !!u.is_vip,
            }));

    return [...baseList].sort((a, b) => {
      const aPriority =
        a.is_vip ||
        a.role === "coordinator" ||
        (a.job_category || "").toLowerCase().includes("coordinador") ||
        (a.employment_type || "").toLowerCase().includes("planta")
          ? 0
          : 1;
      const bPriority =
        b.is_vip ||
        b.role === "coordinator" ||
        (b.job_category || "").toLowerCase().includes("coordinador") ||
        (b.employment_type || "").toLowerCase().includes("planta")
          ? 0
          : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [assignableStaffUsers, usersList]);

  const handleToggleSpaceStatus = async (params: {
    areaId?: number;
    specialSpaceId?: string;
    enabled: boolean;
    label: string;
  }) => {
    const key =
      typeof params.areaId === "number"
        ? `area:${params.areaId}`
        : `special:${params.specialSpaceId || ""}`;
    setTogglingSpaceKey(key);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await toggleSpaceStatusBySuperAdminAction({
        areaId: params.areaId,
        specialSpaceId: params.specialSpaceId,
        enabled: params.enabled,
        accessToken: session?.access_token,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.config) {
        setEnvGlobalConfig(res.config);
        toast.success(
          params.enabled
            ? `${params.label} HABILITADO para reservas.`
            : `${params.label} DESHABILITADO.`,
        );
      }
    } catch {
      toast.error(
        `No se pudo actualizar el estado de ${params.label}. Verifica tu sesión.`,
      );
    } finally {
      setTogglingSpaceKey(null);
    }
  };

  const handleAddConfig = async (type: "areas" | "categories") => {
    if (!newConfigItem) return;
    const { error } = await supabase
      .from(type)
      .insert({ name: newConfigItem.toUpperCase() });

    if (error) {
      console.error(`Error adding ${type}:`, error);
      if (error.code === "23505") {
        toast.warning("Error: Este elemento ya existe (duplicado).");
      } else if (error.code === "42501") {
        toast.error(
          "Error de permisos: No tienes autorización para crear este elemento.",
        );
      } else {
        toast.error(`Error al guardar: ${error.message}`);
      }
    } else {
      setNewConfigItem("");
      onRefreshConfig();
    }
  };

  const handleDeleteConfig = async (
    type: "areas" | "categories",
    id: number,
  ) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    await supabase.from(type).delete().eq("id", id);
    onRefreshConfig();
  };

  const isSuperAdminRole =
    (currentUser?.role || "").toLowerCase() === "superadmin";

  return (
    <section className="animate-in fade-in slide-in-from-right-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* ÁREAS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-sena-blue" /> Gestión de Áreas
        </h3>
        {currentUser?.role !== "admin" && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Nueva área..."
              className="flex-1 border p-2 rounded"
              value={newConfigItem}
              onChange={(e) => setNewConfigItem(e.target.value)}
            />
            <button
              onClick={() => handleAddConfig("areas")}
              className="bg-sena-green text-white px-4 py-2 rounded font-bold"
            >
              +
            </button>
          </div>
        )}
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {areas.map((area) => {
            const isAreaDisabled = envGlobalConfig.disabled_area_ids.includes(
              area.id,
            );
            return (
              <li
                key={area.id}
                className={`flex justify-between items-center p-2.5 rounded-lg border transition ${
                  isAreaDisabled
                    ? "bg-red-50/60 border-red-200 text-red-700"
                    : "bg-gray-50 border-gray-100 text-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-sm font-medium truncate ${
                      isAreaDisabled ? "line-through opacity-75" : ""
                    }`}
                  >
                    {area.name}
                  </span>
                  {isAreaDisabled && (
                    <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                      Inhabilitado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSuperAdminRole && (
                    <button
                      type="button"
                      disabled={togglingSpaceKey === `area:${area.id}`}
                      onClick={() =>
                        handleToggleSpaceStatus({
                          areaId: area.id,
                          enabled: isAreaDisabled,
                          label: `Espacio "${area.name}"`,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        !isAreaDisabled ? "bg-sena-green" : "bg-gray-300"
                      }`}
                      title={
                        isAreaDisabled
                          ? "Espacio Inhabilitado (Clic para Habilitar)"
                          : "Espacio Habilitado (Clic para Deshabilitar)"
                      }
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          !isAreaDisabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  )}
                  {isSuperAdminRole && (
                    <button
                      onClick={() => handleDeleteConfig("areas", area.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Eliminar Área"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* CATEGORÍAS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" /> Gestión de Categorías
        </h3>
        {currentUser?.role !== "admin" && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Nueva categoría..."
              className="flex-1 border p-2 rounded"
              value={newConfigItem}
              onChange={(e) => setNewConfigItem(e.target.value)}
            />
            <button
              onClick={() => handleAddConfig("categories")}
              className="bg-purple-600 text-white px-4 py-2 rounded font-bold"
            >
              +
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex justify-between items-center bg-gray-50 p-2 rounded"
            >
              <span>{cat.name}</span>
              {currentUser?.role !== "admin" && (
                <button
                  onClick={() => handleDeleteConfig("categories", cat.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* CONTROL MAESTRO DE ESPACIOS Y RESERVAS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-sena-blue/20 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sena-blue text-white flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-sena-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sena-blue text-base">
                  Control Maestro de Habilitación de Espacios y Orden de
                  Pestañas
                </h3>
                <span className="text-[10px] font-black uppercase bg-sena-blue/10 text-sena-blue px-2.5 py-0.5 rounded-full">
                  Poder Exclusivo SuperAdmin
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                El SuperAdmin es el único con potestad para habilitar o
                deshabilitar espacios de reserva y formación en toda la
                plataforma.
              </p>
            </div>
          </div>
        </div>

        {!isSuperAdminRole ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            Únicamente el rol SuperAdmin puede habilitar o deshabilitar espacios
            institucionales desde este panel.
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                Espacios de Reserva Institucional (Tarjetas del Portal y
                Formulario)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  {
                    id: "1",
                    name: "Auditorio 103",
                    desc: "Capacitaciones y eventos",
                  },
                  {
                    id: "2",
                    name: "Subdirección",
                    desc: "Reuniones gerenciales",
                  },
                  {
                    id: "3",
                    name: "Biblioteca",
                    desc: "Entornos de aprendizaje",
                  },
                  {
                    id: "4",
                    name: "Ambiente 107",
                    desc: "Prerreserva Coordinación",
                  },
                  {
                    id: "5",
                    name: "Ambiente de Cocina",
                    desc: "Prerreserva Gastronomía",
                  },
                ].map((sp) => {
                  const isDisabled =
                    envGlobalConfig.disabled_special_spaces.includes(sp.id);
                  const customCoord = envGlobalConfig.coordinators?.[sp.id];
                  const defaultCoord = DEFAULT_SPACE_COORDINATORS[sp.id];
                  const activeCoord = customCoord || defaultCoord;
                  const isCustom = !!customCoord;

                  return (
                    <div
                      key={sp.id}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
                        isDisabled
                          ? "bg-red-50/40 border-red-200"
                          : "bg-slate-50/70 border-slate-200 hover:border-sena-green"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-800">
                            {sp.name}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isDisabled
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isDisabled ? "Deshabilitado" : "Activo"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {sp.desc}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-col gap-1.5 bg-white/80 p-2 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                              <Shield className="w-3 h-3 text-sena-green" />{" "}
                              Coordinación
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                isCustom
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isCustom ? "Personalizado" : "Por Defecto"}
                            </span>
                          </div>

                          <div className="text-[11px] leading-tight">
                            <p className="font-bold text-slate-800 truncate">
                              {activeCoord?.full_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {activeCoord?.email}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSpaceForCoord({
                                  id: sp.id,
                                  name: sp.name,
                                });
                                setSelectedCoordUserId(
                                  customCoord?.user_id || "",
                                );
                                setCoordSearchQuery("");
                                supabase.auth
                                  .getSession()
                                  .then(({ data }) => {
                                    setIsLoadingAssignableUsers(true);
                                    getAssignableUsersAction(
                                      data.session?.access_token,
                                    )
                                      .then((res) => {
                                        if (res?.success && res.users) {
                                          setAssignableStaffUsers(res.users);
                                        }
                                      })
                                      .catch(() => {})
                                      .finally(() =>
                                        setIsLoadingAssignableUsers(false),
                                      );
                                  })
                                  .catch(() =>
                                    setIsLoadingAssignableUsers(false),
                                  );
                              }}
                              className="text-[10px] font-bold text-white bg-sena-green hover:bg-emerald-700 px-2 py-1 rounded transition-colors flex-1 text-center cursor-pointer"
                            >
                              {isCustom ? "Cambiar" : "Asignar"}
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                title="Restablecer coordinador por defecto"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `¿Restablecer el coordinador institucional por defecto (${defaultCoord?.full_name}) para ${sp.name}?`,
                                    )
                                  )
                                    return;
                                  try {
                                    const {
                                      data: { session },
                                    } = await supabase.auth.getSession();
                                    const res =
                                      await assignSpaceCoordinatorAction({
                                        spaceId: sp.id,
                                        userId: null,
                                        accessToken: session?.access_token,
                                      });
                                    if (res.error) {
                                      toast.error(res.error);
                                      return;
                                    }
                                    if (res.config) {
                                      setEnvGlobalConfig(res.config);
                                      toast.success(
                                        `Coordinador de ${sp.name} restablecido a ${defaultCoord?.full_name}.`,
                                      );
                                    }
                                  } catch {
                                    toast.error(
                                      "Error al restablecer coordinador",
                                    );
                                  }
                                }}
                                className="text-[10px] font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                Restablecer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                        <span className="text-[11px] font-bold text-slate-600">
                          {isDisabled ? "Inactivo" : "Habilitado"}
                        </span>
                        <button
                          type="button"
                          disabled={togglingSpaceKey === `special:${sp.id}`}
                          onClick={() =>
                            handleToggleSpaceStatus({
                              specialSpaceId: sp.id,
                              enabled: isDisabled,
                              label: sp.name,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                            !isDisabled ? "bg-sena-green" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              !isDisabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Orden Fijo de Pestañas en Calendario de Ambientes
                </h4>
                {envGlobalConfig.updated_by && (
                  <span className="text-[11px] text-slate-400">
                    Última modificación por:{" "}
                    <strong>{envGlobalConfig.updated_by}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Puedes reordenar las pestañas desde aquí o directamente en el
                botón <strong>&quot;Ordenar y Fijar Pestañas&quot;</strong>{" "}
                dentro de Gestión de Ambientes.
              </p>
              <div className="flex flex-wrap gap-2">
                {areas
                  .filter(
                    (a) =>
                      (a.name.toUpperCase().includes("AMBIENTE") ||
                        a.name.toUpperCase().includes("AUDITORIO") ||
                        a.name.toUpperCase().includes("SUBDIRECCIÓN") ||
                        a.name.toUpperCase().includes("BIBLIOTECA") ||
                        a.name.toUpperCase().includes("COCINA")) &&
                      !a.name.toUpperCase().includes("KIOSKO") &&
                      !a.name
                        .toUpperCase()
                        .includes("AMBIENTE DE INSTRUCTORES"),
                  )
                  .sort((a, b) => {
                    const idxA = envGlobalConfig.tab_order.indexOf(a.id);
                    const idxB = envGlobalConfig.tab_order.indexOf(b.id);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((area, index, arr) => {
                    const isAreaDisabled =
                      envGlobalConfig.disabled_area_ids.includes(area.id);
                    return (
                      <div
                        key={area.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                          isAreaDisabled
                            ? "bg-red-50 border-red-200 text-red-600 line-through"
                            : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-md bg-sena-blue text-white text-[10px] flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span>{area.name}</span>
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={async () => {
                              try {
                                const {
                                  data: { session },
                                } = await supabase.auth.getSession();
                                const ids = arr.map((x) => x.id);
                                const [moved] = ids.splice(index, 1);
                                ids.splice(index - 1, 0, moved);
                                const res =
                                  await saveEnvironmentsTabOrderAction(
                                    ids,
                                    session?.access_token,
                                  );
                                if (res.error) {
                                  toast.error(res.error);
                                  return;
                                }
                                if (res.config) {
                                  setEnvGlobalConfig(res.config);
                                  toast.success("Orden actualizado.");
                                }
                              } catch {
                                toast.error("No se pudo guardar el orden.");
                              }
                            }}
                            className="px-1.5 py-0.5 bg-white border rounded hover:bg-sena-blue hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Mover a la izquierda"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            disabled={index === arr.length - 1}
                            onClick={async () => {
                              try {
                                const {
                                  data: { session },
                                } = await supabase.auth.getSession();
                                const ids = arr.map((x) => x.id);
                                const [moved] = ids.splice(index, 1);
                                ids.splice(index + 1, 0, moved);
                                const res =
                                  await saveEnvironmentsTabOrderAction(
                                    ids,
                                    session?.access_token,
                                  );
                                if (res.error) {
                                  toast.error(res.error);
                                  return;
                                }
                                if (res.config) {
                                  setEnvGlobalConfig(res.config);
                                  toast.success("Orden actualizado.");
                                }
                              } catch {
                                toast.error("No se pudo guardar el orden.");
                              }
                            }}
                            className="px-1.5 py-0.5 bg-white border rounded hover:bg-sena-blue hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Mover a la derecha"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REMODELACIÓN / MANTENIMIENTO MULTI-AMBIENTE */}
      <div
        id="maintenance-config-card"
        className="bg-white p-6 rounded-xl shadow-sm border border-amber-200 md:col-span-2 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base">
                Pausa de Reservas / Remodelación de Ambientes
              </h3>
              <p className="text-xs text-gray-500">
                Selecciona el ambiente o auditorio a pausar por obras o
                mantenimiento. Puedes gestionar varios espacios simultáneamente
                y habilitarlos de inmediato.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSavingMaintenance}
            onClick={async () => {
              setIsSavingMaintenance(true);
              try {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                const selectedSpaceObj = availableMaintenanceSpaces.all.find(
                  (s) => s.id === maintenanceConfig.space_id,
                );
                const spaceName =
                  maintenanceConfig.space_name ||
                  selectedSpaceObj?.name ||
                  "Auditorio 103";

                if (maintenanceConfig.is_active) {
                  const res = await disableSpaceMaintenanceAction({
                    spaceId: maintenanceConfig.space_id,
                    spaceName,
                    accessToken: session?.access_token,
                  });
                  if (res?.error) {
                    toast.error(res.error);
                    return;
                  }
                  if (res?.config) setMaintenanceConfig(res.config);
                  if (res?.configs) setSpacesMaintenanceMap(res.configs);
                  toast.success(
                    `¡${spaceName} HABILITADO de inmediato! Se envió notificación a los usuarios.`,
                  );
                } else {
                  const updated: SpaceMaintenanceConfig = {
                    ...maintenanceConfig,
                    space_name: spaceName,
                    is_active: true,
                  };
                  const res = await saveSpaceMaintenanceAction({
                    ...updated,
                    accessToken: session?.access_token,
                  });
                  if (res?.error) {
                    toast.error(res.error);
                    return;
                  }
                  if (res?.config) setMaintenanceConfig(res.config);
                  if (res?.configs) setSpacesMaintenanceMap(res.configs);
                  if (res.cancelledCount && res.cancelledCount > 0) {
                    toast.warning(
                      `Pausa ACTIVADA para ${spaceName}. Se cancelaron ${res.cancelledCount} reserva(s) y se notificó a ${res.usersNotified} usuario(s) por correo consolidado.`,
                      { duration: 8000 },
                    );
                  } else {
                    toast.success(
                      `Bloqueo por remodelación/pausa ACTIVADO en ${spaceName} (sin reservas previas por cancelar).`,
                    );
                  }
                }
              } catch (err: unknown) {
                toast.error(
                  err instanceof Error ? err.message : "Error al guardar",
                );
              } finally {
                setIsSavingMaintenance(false);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
              maintenanceConfig.is_active
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }`}
          >
            {maintenanceConfig.is_active
              ? "DESACTIVAR PAUSA Y HABILITAR"
              : "ACTIVAR PAUSA"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Ambiente o Auditorio *
            </label>
            <select
              value={maintenanceConfig.space_id}
              onChange={(e) => {
                const newId = e.target.value;
                const foundSpace = availableMaintenanceSpaces.all.find(
                  (s) => s.id === newId,
                );
                const existingCfg = spacesMaintenanceMap[newId];
                if (existingCfg) {
                  setMaintenanceConfig({
                    ...existingCfg,
                    space_name:
                      existingCfg.space_name ||
                      foundSpace?.name ||
                      "Espacio Institucional",
                  });
                } else {
                  const sName = foundSpace?.name || "Espacio Institucional";
                  setMaintenanceConfig({
                    is_active: false,
                    space_id: newId,
                    space_name: sName,
                    start_date:
                      maintenanceConfig.start_date ||
                      new Date().toISOString().split("T")[0],
                    end_date: null,
                    custom_title: `${sName} en Remodelación`,
                    custom_message: "",
                  });
                }
              }}
              className="border border-slate-300 p-2.5 rounded-lg w-full text-sm font-semibold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-amber-500"
            >
              <optgroup label="Espacios de Reserva Institucional">
                {availableMaintenanceSpaces.special.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                    {spacesMaintenanceMap[sp.id]?.is_active ? " (PAUSADO)" : ""}
                  </option>
                ))}
              </optgroup>
              {availableMaintenanceSpaces.extraAreas.length > 0 && (
                <optgroup label="Otros Ambientes de Formación">
                  {availableMaintenanceSpaces.extraAreas.map((ar) => (
                    <option key={ar.id} value={ar.id}>
                      {ar.name}
                      {spacesMaintenanceMap[ar.id]?.is_active
                        ? " (PAUSADO)"
                        : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Fecha de Inicio de Obras / Pausa *
            </label>
            <input
              type="date"
              value={maintenanceConfig.start_date}
              onChange={(e) =>
                setMaintenanceConfig({
                  ...maintenanceConfig,
                  start_date: e.target.value,
                })
              }
              className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Fecha Estimada de Fin (Opcional)
            </label>
            <input
              type="date"
              value={maintenanceConfig.end_date || ""}
              onChange={(e) =>
                setMaintenanceConfig({
                  ...maintenanceConfig,
                  end_date: e.target.value || null,
                })
              }
              className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-[10px] text-gray-400 mt-1 block">
              {maintenanceConfig.end_date
                ? "Indica fecha estimada de reapertura."
                : "Sin fecha: Bloqueará por el resto de la vigencia 2026."}
            </span>
          </div>

          <div className="md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Título / Motivo del Aviso (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Obras de adecuación eléctrica y pintura"
                value={maintenanceConfig.custom_title || ""}
                onChange={(e) =>
                  setMaintenanceConfig({
                    ...maintenanceConfig,
                    custom_title: e.target.value,
                  })
                }
                className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Detalle o Instrucción para Usuarios (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Eventos reprogramados comunicarse con Coordinación"
                value={maintenanceConfig.custom_message || ""}
                onChange={(e) =>
                  setMaintenanceConfig({
                    ...maintenanceConfig,
                    custom_message: e.target.value,
                  })
                }
                className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSavingMaintenance}
            onClick={async () => {
              setIsSavingMaintenance(true);
              try {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                const selectedSpaceObj = availableMaintenanceSpaces.all.find(
                  (s) => s.id === maintenanceConfig.space_id,
                );
                const spaceName =
                  maintenanceConfig.space_name ||
                  selectedSpaceObj?.name ||
                  "Auditorio 103";

                const res = await saveSpaceMaintenanceAction({
                  ...maintenanceConfig,
                  space_name: spaceName,
                  accessToken: session?.access_token,
                });
                if (res?.error) {
                  toast.error(res.error);
                  return;
                }
                if (res?.config) setMaintenanceConfig(res.config);
                if (res?.configs) setSpacesMaintenanceMap(res.configs);
                toast.success(
                  `Configuración de ${spaceName} guardada exitosamente.`,
                );
              } catch (err: unknown) {
                toast.error(
                  err instanceof Error ? err.message : "Error al guardar",
                );
              } finally {
                setIsSavingMaintenance(false);
              }
            }}
            className="bg-sena-green hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            Guardar Configuración
          </button>
        </div>

        <div className="pt-5 border-t border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              Ambientes con Pausa o Remodelación Activa
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                {pausedSpacesList.length}
              </span>
            </h4>
          </div>

          {pausedSpacesList.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Todos los ambientes y auditorios se encuentran habilitados para
              reservas en este momento.
            </div>
          ) : (
            <div className="space-y-2.5">
              {pausedSpacesList.map((entry) => {
                const displayName =
                  entry.space_name ||
                  availableMaintenanceSpaces.all.find(
                    (s) => s.id === entry.space_id,
                  )?.name ||
                  entry.space_id;
                return (
                  <div
                    key={entry.space_id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-800">
                          {displayName}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          En Pausa / Remodelación
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        <strong>Inicio:</strong> {entry.start_date}{" "}
                        &nbsp;|&nbsp; <strong>Fin estimado:</strong>{" "}
                        {entry.end_date || "Vigencia 2026"}
                      </p>
                      {(entry.custom_title || entry.custom_message) && (
                        <p className="text-[11px] text-amber-900 truncate">
                          {entry.custom_title}
                          {entry.custom_message
                            ? ` — ${entry.custom_message}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMaintenanceConfig({
                            ...entry,
                            space_name: displayName,
                          });
                          document
                            .getElementById("maintenance-config-card")
                            ?.scrollIntoView({ behavior: "smooth" });
                          toast.info(
                            `Editando configuración de pausa para ${displayName}.`,
                          );
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Modificar
                      </button>
                      <button
                        type="button"
                        disabled={isSavingMaintenance}
                        onClick={async () => {
                          setIsSavingMaintenance(true);
                          try {
                            const {
                              data: { session },
                            } = await supabase.auth.getSession();
                            const res = await disableSpaceMaintenanceAction({
                              spaceId: entry.space_id,
                              spaceName: displayName,
                              accessToken: session?.access_token,
                            });
                            if (res?.error) {
                              toast.error(res.error);
                              return;
                            }
                            if (res?.configs) {
                              setSpacesMaintenanceMap(res.configs);
                            }
                            if (
                              maintenanceConfig.space_id === entry.space_id &&
                              res?.config
                            ) {
                              setMaintenanceConfig(res.config);
                            }
                            toast.success(
                              `¡${displayName} habilitado de inmediato! Los usuarios han sido notificados.`,
                              { duration: 6000 },
                            );
                          } catch {
                            toast.error(
                              `No se pudo desactivar la pausa de ${displayName}. Verifica tu sesión.`,
                            );
                          } finally {
                            setIsSavingMaintenance(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Desactivar y Habilitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(envGlobalConfig.disabled_special_spaces.length > 0 ||
            envGlobalConfig.disabled_area_ids.length > 0) && (
            <div className="mt-5 pt-4 border-t border-red-100 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-2">
                Espacios Deshabilitados desde Control Maestro
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800">
                  {envGlobalConfig.disabled_special_spaces.length +
                    envGlobalConfig.disabled_area_ids.length}
                </span>
              </h4>
              <div className="space-y-2">
                {envGlobalConfig.disabled_special_spaces.map((spId) => {
                  const spMeta = SPECIAL_SPACES_CATALOG.find(
                    (s) => s.id === String(spId),
                  );
                  const label = spMeta?.name || `Espacio especial #${spId}`;
                  return (
                    <div
                      key={`disabled-special-${spId}`}
                      className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">
                          {label}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Deshabilitado
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={togglingSpaceKey === `special:${spId}`}
                        onClick={() =>
                          handleToggleSpaceStatus({
                            specialSpaceId: String(spId),
                            enabled: true,
                            label,
                          })
                        }
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Habilitar de Inmediato
                      </button>
                    </div>
                  );
                })}
                {envGlobalConfig.disabled_area_ids.map((arId) => {
                  const areaObj = areas.find((a) => a.id === arId);
                  const label = areaObj?.name || `Ambiente #${arId}`;
                  return (
                    <div
                      key={`disabled-area-${arId}`}
                      className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">
                          {label}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Deshabilitado
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={togglingSpaceKey === `area:${arId}`}
                        onClick={() =>
                          handleToggleSpaceStatus({
                            areaId: Number(arId),
                            enabled: true,
                            label: `Espacio "${label}"`,
                          })
                        }
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Habilitar de Inmediato
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL ASIGNAR COORDINADOR DE AMBIENTE */}
      <NativeDialog
        isOpen={Boolean(selectedSpaceForCoord)}
        onClose={() => setSelectedSpaceForCoord(null)}
        title="Asignar Coordinador"
        subtitle={selectedSpaceForCoord?.name || ""}
        badgeText="GOV·SENA·COORD"
        headerIcon={<Shield className="w-5 h-5 text-emerald-300" />}
        maxWidthClass="max-w-lg"
      >
        <div className="p-6 overflow-y-auto space-y-4 max-h-[65dvh]">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Privilegios y Requisitos:</p>
              <p className="mt-0.5 text-blue-800">
                Solo funcionarios VIP o de planta pueden ser designados. Al
                asignar al usuario, el sistema garantizará automáticamente sus
                credenciales VIP y reasignará las solicitudes pendientes de
                autorización de este espacio.
              </p>
            </div>
          </div>

          <div>
            <label className="swiss-section-tag block mb-1.5">
              01 / BUSCAR FUNCIONARIO O COORDINADOR
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nombre, usuario o correo..."
                value={coordSearchQuery}
                onChange={(e) => setCoordSearchQuery(e.target.value)}
                className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sena-green"
              />
            </div>
          </div>

          <div>
            <label className="swiss-section-tag block mb-1.5">
              02 / SELECCIONAR FUNCIONARIO
            </label>
            <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
              {(() => {
                const q = coordSearchQuery.toLowerCase().trim();
                const filtered = coordinatorCandidateUsers.filter((u) => {
                  if (!q) return true;
                  return (
                    (u.full_name || "").toLowerCase().includes(q) ||
                    (u.username || "").toLowerCase().includes(q) ||
                    (u.email || "").toLowerCase().includes(q) ||
                    (u.area || "").toLowerCase().includes(q) ||
                    (u.job_category || "").toLowerCase().includes(q)
                  );
                });

                if (isLoadingAssignableUsers && filtered.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-sena-green" />
                      Cargando directorio de funcionarios...
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-slate-500">
                      {coordSearchQuery.trim()
                        ? `No se encontraron funcionarios que coincidan con "${coordSearchQuery}".`
                        : "No hay funcionarios disponibles en el directorio."}
                    </div>
                  );
                }

                return filtered.map((u) => {
                  const isVipUser =
                    !!u.is_vip ||
                    u.role === "coordinator" ||
                    (u.job_category || "")
                      .toLowerCase()
                      .includes("coordinador");
                  const isPlanta = (u.employment_type || "")
                    .toLowerCase()
                    .includes("planta");
                  const isSelected = selectedCoordUserId === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedCoordUserId(u.id)}
                      className={`p-3 cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected
                          ? "bg-emerald-50 border-l-4 border-sena-green"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {u.full_name}
                        </p>
                        <p className="tabular-mono text-[11px] text-slate-500 truncate">
                          @{u.username} ·{" "}
                          {u.email || `${u.username}@sena.edu.co`}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isVipUser ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            VIP
                          </span>
                        ) : isPlanta ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Planta
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {u.role || "Funcionario"}
                          </span>
                        )}
                        <input
                          type="radio"
                          name="coordUser"
                          checked={isSelected}
                          onChange={() => setSelectedCoordUserId(u.id)}
                          className="text-sena-green focus:ring-sena-green h-4 w-4"
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSelectedSpaceForCoord(null)}
            disabled={isAssigningCoord}
            className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedCoordUserId || isAssigningCoord}
            onClick={async () => {
              if (!selectedCoordUserId || !selectedSpaceForCoord) return;
              setIsAssigningCoord(true);
              try {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                const res = await assignSpaceCoordinatorAction({
                  spaceId: selectedSpaceForCoord.id,
                  userId: selectedCoordUserId,
                  accessToken: session?.access_token,
                });
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                if (res.config) {
                  setEnvGlobalConfig(res.config);
                  if (
                    typeof res.transferredCount === "number" &&
                    res.transferredCount > 0
                  ) {
                    toast.success(
                      `Coordinador asignado con éxito. Se trasladaron ${res.transferredCount} solicitud(es) pendiente(s) a su bandeja.`,
                    );
                  } else {
                    toast.success(
                      `Coordinador de ${selectedSpaceForCoord.name} asignado correctamente.`,
                    );
                  }
                  setSelectedSpaceForCoord(null);
                }
              } catch {
                toast.error("Error al asignar coordinador");
              } finally {
                setIsAssigningCoord(false);
              }
            }}
            className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-sena-green hover:bg-emerald-700 active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            {isAssigningCoord ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Asignando...
              </>
            ) : (
              "Confirmar Asignación"
            )}
          </button>
        </div>
      </NativeDialog>
    </section>
  );
}
