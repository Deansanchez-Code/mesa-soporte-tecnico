"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Plus,
  MapPin,
  X,
  UserCheck,
  Calendar,
  Clock,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Pin,
  Check,
  Power,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import BulkAssignmentModal from "./BulkAssignmentModal";
import CalendarView from "./CalendarView";
import { Assignment } from "../types";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import {
  getAssignableUsersAction,
  AssignableUser,
  updateInstructorAssignmentAction,
  saveEnvironmentsTabOrderAction,
  toggleSpaceStatusBySuperAdminAction,
} from "@/features/reservations/actions/reservationActions";
import {
  getEnvironmentsGlobalConfig,
  DEFAULT_ENVIRONMENTS_CONFIG,
} from "@/features/reservations/services/maintenanceService";
import { EnvironmentsGlobalConfig } from "@/features/reservations/types";
import { TIME_BLOCKS, TimeBlock } from "@/lib/scheduling";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";

interface Environment {
  id: number;
  name: string;
  type: string;
  capacity: number;
}

export default function AssignmentManager({
  canManage,
  canDeleteAuditorium,
  user,
}: {
  canManage: boolean;
  canDeleteAuditorium: boolean;
  user?: UserProfile["profile"];
}) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingRes, setEditingRes] = useState<Assignment | null>(null);

  // State for editing a standard block assignment (instructor_assignments)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [editInstructorId, setEditInstructorId] = useState("");
  const [editAssignmentDate, setEditAssignmentDate] = useState("");
  const [editTimeBlock, setEditTimeBlock] = useState<TimeBlock>("MANANA");
  const [editUserSearch, setEditUserSearch] = useState("");
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false);

  useEffect(() => {
    if (editingRes && !editingRes.is_reservation) {
      setEditInstructorId(editingRes.instructor_id || editingRes.user_id || "");
      setEditAssignmentDate(editingRes.assignment_date);
      setEditTimeBlock((editingRes.time_block as TimeBlock) || "MANANA");
      setEditUserSearch("");
      if (assignableUsers.length === 0) {
        getAssignableUsersAction().then((res) => {
          if (res.success && res.users) {
            setAssignableUsers(res.users);
          }
        });
      }
    }
  }, [editingRes, assignableUsers.length]);

  const [selectedDateForCreate, setSelectedDateForCreate] = useState<
    string | undefined
  >(undefined);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);

  // Global Order & Disable Config State
  const [globalConfig, setGlobalConfig] = useState<EnvironmentsGlobalConfig>(
    DEFAULT_ENVIRONMENTS_CONFIG,
  );
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [draftOrderEnvList, setDraftOrderEnvList] = useState<Environment[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const uProfile = user as
    | {
        role?: string;
        job_category?: string;
        username?: string;
        perm_manage_assignments?: boolean;
        employment_type?: string;
      }
    | undefined;
  const userRoleLower = (uProfile?.role || "").toLowerCase();
  const userJobCatLower = (uProfile?.job_category || "").toLowerCase();
  const userCleanUsername = (uProfile?.username || "").toLowerCase().trim();

  const isSuperAdmin = userRoleLower === "superadmin";
  const isCoordinator =
    userJobCatLower === "coordinador" ||
    userRoleLower === "coordinator" ||
    !!uProfile?.perm_manage_assignments ||
    ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
      userCleanUsername,
    );

  // REGLA 1: Solo las Coordinaciones y el SuperAdmin pueden modificar y fijar el orden de las pestañas
  const canReorderTabs = isCoordinator || isSuperAdmin;

  const fetchEnvironments = async () => {
    setLoading(true);
    const [{ data }, cfg] = await Promise.all([
      supabase
        .from("areas")
        .select("id, name")
        .or(
          "name.ilike.%AMBIENTE%,name.ilike.%AUDITORIO%,name.ilike.%SUBDIRECCIÓN%,name.ilike.%BIBLIOTECA%,name.ilike.%COCINA%",
        )
        .not("name", "ilike", "%KIOSKO%")
        .order("name"),
      getEnvironmentsGlobalConfig(),
    ]);

    setGlobalConfig(cfg);

    if (data) {
      // Filter out "AMBIENTE DE INSTRUCTORES"
      const filtered = data.filter(
        (d) => !d.name.toUpperCase().includes("AMBIENTE DE INSTRUCTORES"),
      );

      // --- RBAC Filter for Subdirección ---
      const empType = (uProfile?.employment_type || "").toLowerCase();
      const isOfficial =
        empType.includes("planta") ||
        empType.includes("funcionario") ||
        empType.includes("oficial");
      const isAdmin = ["admin", "superadmin"].includes(userRoleLower);

      const rbacFiltered = filtered.filter((d) => {
        if (d.name.toUpperCase().includes("SUBDIRECCIÓN")) {
          return isOfficial || isAdmin;
        }
        return true;
      });

      const orderMap = new Map<number, number>();
      cfg.tab_order.forEach((id, idx) => orderMap.set(id, idx));

      const mapped = rbacFiltered
        .map((d: { id: number; name: string }) => ({
          id: d.id,
          name: d.name,
          type: "AREA",
          capacity: 0,
        }))
        .sort((a, b) => {
          const aSavedIdx = orderMap.get(a.id);
          const bSavedIdx = orderMap.get(b.id);
          if (aSavedIdx !== undefined && bSavedIdx !== undefined) {
            return aSavedIdx - bSavedIdx;
          }
          if (aSavedIdx !== undefined) return -1;
          if (bSavedIdx !== undefined) return 1;

          // Fallback default priority: AUDITORIO, BIBLIOTECA, SUBDIRECCIÓN, 107, COCINA
          const getPriority = (name: string) => {
            const upper = name.toUpperCase();
            if (upper.includes("AUDITORIO")) return 1;
            if (upper.includes("BIBLIOTECA")) return 2;
            if (upper.includes("SUBDIRECCIÓN")) return 3;
            if (upper.includes("107")) return 4;
            if (upper.includes("COCINA")) return 5;
            return 6;
          };
          const aPriority = getPriority(a.name);
          const bPriority = getPriority(b.name);

          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.name.localeCompare(b.name);
        });

      setEnvironments(mapped);
      const activeEnvs = isSuperAdmin
        ? mapped
        : mapped.filter((e) => !cfg.disabled_area_ids.includes(e.id));
      if (activeEnvs.length > 0 && !selectedEnvId) {
        setSelectedEnvId(activeEnvs[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEnvironments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleEnvironments = isSuperAdmin
    ? environments
    : environments.filter(
        (env) => !globalConfig.disabled_area_ids.includes(env.id),
      );

  const selectedEnv = visibleEnvironments.find((e) => e.id === selectedEnvId);
  const isSelectedEnvDisabled = selectedEnv
    ? globalConfig.disabled_area_ids.includes(selectedEnv.id)
    : false;

  const moveDraftItem = (idx: number, direction: "UP" | "DOWN") => {
    const targetIdx = direction === "UP" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= draftOrderEnvList.length) return;
    const copy = [...draftOrderEnvList];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    setDraftOrderEnvList(copy);
  };

  const pinDraftItemFirst = (idx: number) => {
    if (idx <= 0) return;
    const copy = [...draftOrderEnvList];
    const [moved] = copy.splice(idx, 1);
    copy.unshift(moved);
    setDraftOrderEnvList(copy);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    const newIds = draftOrderEnvList.map((e) => e.id);
    const res = await saveEnvironmentsTabOrderAction(newIds);
    setSavingOrder(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.config) {
      setGlobalConfig(res.config);
    }
    setEnvironments(draftOrderEnvList);
    setIsOrderModalOpen(false);
    toast.success(
      "Orden de pestañas de ambientes fijado permanentemente para todos los usuarios.",
    );
  };

  const handleSuperAdminToggleArea = async (
    areaId: number,
    currentlyDisabled: boolean,
  ) => {
    const res = await toggleSpaceStatusBySuperAdminAction({
      areaId,
      enabled: currentlyDisabled, // if currently disabled, enable it
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.config) {
      setGlobalConfig(res.config);
      toast.success(
        currentlyDisabled
          ? "Espacio HABILITADO exitosamente."
          : "Espacio DESHABILITADO exitosamente.",
      );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
      {/* HEADER: Tabs de Ambientes */}
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <MapPin className="text-sena-green" />
              Gestión de Ambientes
            </h2>
            {globalConfig.updated_by && (
              <p className="text-[11px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                <Pin className="w-3 h-3 text-sena-blue" />
                Orden fijado por Coordinación / SuperAdmin (
                {globalConfig.updated_by})
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Botón Exclusivo Coordinación y SuperAdmin para Ordenar y Fijar Pestañas */}
            {canReorderTabs && (
              <button
                type="button"
                onClick={() => {
                  setDraftOrderEnvList([...environments]);
                  setIsOrderModalOpen(true);
                }}
                className="bg-slate-100 hover:bg-sena-blue hover:text-white text-sena-blue border border-slate-200 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-2xs cursor-pointer"
                title="Exclusivo Coordinaciones y SuperAdmin: Cambiar y fijar el orden de las pestañas"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Ordenar y Fijar Pestañas
              </button>
            )}

            {/* Toggle rápido de SuperAdmin sobre el ambiente seleccionado */}
            {isSuperAdmin && selectedEnv && (
              <button
                type="button"
                onClick={() =>
                  handleSuperAdminToggleArea(
                    selectedEnv.id,
                    isSelectedEnvDisabled,
                  )
                }
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
                  isSelectedEnvDisabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white"
                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white"
                }`}
                title="Poder exclusivo SuperAdmin: Habilitar o deshabilitar este ambiente"
              >
                <Power className="w-3.5 h-3.5" />
                {isSelectedEnvDisabled
                  ? "Habilitar este Ambiente"
                  : "Deshabilitar Ambiente"}
              </button>
            )}

            {!isSelectedEnvDisabled &&
              (canManage ||
                (selectedEnv &&
                  (selectedEnv.name.toUpperCase().includes("AUDITORIO") ||
                    selectedEnv.name.toUpperCase().includes("SUBDIRECCIÓN") ||
                    selectedEnv.name.toUpperCase().includes("BIBLIOTECA") ||
                    selectedEnv.name.toUpperCase().includes("107") ||
                    selectedEnv.name.toUpperCase().includes("COCINA")))) && (
                <button
                  onClick={() => {
                    if (
                      selectedEnv?.name.toUpperCase().includes("AUDITORIO") ||
                      selectedEnv?.name
                        .toUpperCase()
                        .includes("SUBDIRECCIÓN") ||
                      selectedEnv?.name.toUpperCase().includes("BIBLIOTECA") ||
                      selectedEnv?.name.toUpperCase().includes("107") ||
                      selectedEnv?.name.toUpperCase().includes("COCINA")
                    ) {
                      // Specific RBAC for Subdirección Button (VIP/Admin only)
                      if (
                        selectedEnv?.name.toUpperCase().includes("SUBDIRECCIÓN")
                      ) {
                        const isVip = !!(user as never as { is_vip?: boolean })
                          ?.is_vip;
                        const userRole = (
                          (user?.role as string) || ""
                        ).toLowerCase();
                        const isAdmin = ["admin", "superadmin"].includes(
                          userRole,
                        );

                        if (!isVip && !isAdmin) {
                          toast.error(
                            "Solo el personal VIP puede realizar reservas en Subdirección.",
                          );
                          return;
                        }
                      }

                      // Specific RBAC for Biblioteca Button
                      if (
                        selectedEnv?.name.toUpperCase().includes("BIBLIOTECA")
                      ) {
                        const userEmail = (
                          (user?.email as string) || ""
                        ).toLowerCase();
                        const userRole = (
                          (user?.role as string) || ""
                        ).toLowerCase();
                        const isVip = !!(user as never as { is_vip?: boolean })
                          ?.is_vip;
                        const isInstructor =
                          (
                            user as never as { job_category?: string }
                          )?.job_category?.toLowerCase() === "instructor";
                        const isPlanta = (
                          user as never as { employment_type?: string }
                        )?.employment_type
                          ?.toLowerCase()
                          .includes("planta");

                        const isAdmin = ["admin", "superadmin"].includes(
                          userRole,
                        );
                        const isAllowed = [
                          "egutierrezn@sistema.local",
                          "rbiblioteca@sistema.local",
                        ].includes(userEmail);

                        if (
                          !isAllowed &&
                          !isAdmin &&
                          !isVip &&
                          !isInstructor &&
                          !isPlanta
                        ) {
                          toast.error(
                            "No tienes permisos para realizar reservas en Biblioteca.",
                          );
                          return;
                        }
                      }

                      setIsReservationModalOpen(true);
                    } else {
                      setIsModalOpen(true);
                    }
                  }}
                  className="bg-sena-green text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-900/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {selectedEnv?.name.toUpperCase().includes("AUDITORIO") ||
                  selectedEnv?.name.toUpperCase().includes("SUBDIRECCIÓN") ||
                  selectedEnv?.name.toUpperCase().includes("BIBLIOTECA") ||
                  selectedEnv?.name.toUpperCase().includes("107") ||
                  selectedEnv?.name.toUpperCase().includes("COCINA")
                    ? "Nueva Reserva"
                    : "Nueva Asignación"}
                </button>
              )}
          </div>
        </div>

        {/* Pestañas de Ambientes (Con envoltura limpia y estado fijo) */}
        <div className="flex flex-wrap gap-2 pb-1">
          {visibleEnvironments.map((env) => {
            const isDisabled = globalConfig.disabled_area_ids.includes(env.id);
            const isSelected = selectedEnvId === env.id;
            return (
              <button
                key={env.id}
                onClick={() => setSelectedEnvId(env.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isDisabled
                      ? "bg-red-50 text-red-700 border-2 border-red-300 shadow-xs"
                      : "bg-sena-blue text-white border-2 border-sena-blue shadow-sm"
                    : isDisabled
                      ? "bg-red-50/50 text-red-400 border border-red-200 line-through opacity-75 hover:opacity-100"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-sena-blue border border-slate-200/80"
                }`}
              >
                {env.name}
                {isDisabled && (
                  <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                    Inhabilitado
                  </span>
                )}
              </button>
            );
          })}
          {loading && (
            <div className="text-xs text-gray-400 p-2">
              Cargando ambientes...
            </div>
          )}
        </div>
      </div>

      {/* CONTENT: Calendario */}
      <div className="flex-1 p-6 bg-gray-50/50">
        {selectedEnvId ? (
          <CalendarView
            areaId={selectedEnvId}
            areaName={selectedEnv?.name || ""}
            key={selectedEnvId + "-" + refreshTrigger} // Force re-render on switch
            canManage={canManage}
            canDeleteAuditorium={canDeleteAuditorium}
            user={user}
            onEdit={(res) => setEditingRes(res)}
            onCreateForDate={(date) => {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              setSelectedDateForCreate(`${y}-${m}-${d}`);

              if (
                selectedEnv?.name.toUpperCase().includes("AUDITORIO") ||
                selectedEnv?.name.toUpperCase().includes("SUBDIRECCIÓN") ||
                selectedEnv?.name.toUpperCase().includes("BIBLIOTECA") ||
                selectedEnv?.name.toUpperCase().includes("107") ||
                selectedEnv?.name.toUpperCase().includes("COCINA")
              ) {
                setIsReservationModalOpen(true);
              } else {
                setIsModalOpen(true);
              }
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MapPin className="w-12 h-12 mb-2 opacity-50" />
            <p>Selecciona un ambiente para ver su programación.</p>
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && selectedEnv && (
        <BulkAssignmentModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDateForCreate(undefined);
          }}
          environmentId={selectedEnv.id}
          environmentName={selectedEnv.name}
          onSuccess={() => {
            setSelectedDateForCreate(undefined);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {/* NEW RESERVATION MODAL */}
      {isReservationModalOpen && selectedEnv && user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <AuditoriumReservationForm
              user={user}
              initialDate={selectedDateForCreate}
              initialSpace={
                selectedEnv.name.toUpperCase().includes("AUDITORIO")
                  ? "1"
                  : selectedEnv.name.toUpperCase().includes("SUBDIRECCIÓN")
                    ? "2"
                    : selectedEnv.name.toUpperCase().includes("107")
                      ? "4"
                      : selectedEnv.name.toUpperCase().includes("COCINA")
                        ? "5"
                        : "3"
              }
              onCancel={() => {
                setIsReservationModalOpen(false);
                setSelectedDateForCreate(undefined);
              }}
              onSuccess={() => {
                setIsReservationModalOpen(false);
                setSelectedDateForCreate(undefined);
                setRefreshTrigger((prev) => prev + 1);
              }}
            />
          </div>
        </div>
      )}

      {/* EDIT MODAL FOR RESERVATIONS OR ASSIGNMENTS */}
      {editingRes &&
        user &&
        (() => {
          const isSpecialSpace =
            selectedEnv?.name.toUpperCase().includes("AUDITORIO") ||
            selectedEnv?.name.toUpperCase().includes("SUBDIRECCIÓN") ||
            selectedEnv?.name.toUpperCase().includes("BIBLIOTECA") ||
            selectedEnv?.name.toUpperCase().includes("107") ||
            selectedEnv?.name.toUpperCase().includes("COCINA");

          if (editingRes.is_reservation || isSpecialSpace) {
            return (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                  <AuditoriumReservationForm
                    user={user}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    reservationToEdit={editingRes as any}
                    legacyAssignmentIdToReplace={
                      !editingRes.is_reservation ? editingRes.id : undefined
                    }
                    initialSpace={
                      selectedEnv?.name.toUpperCase().includes("AUDITORIO")
                        ? "1"
                        : selectedEnv?.name
                              .toUpperCase()
                              .includes("SUBDIRECCIÓN")
                          ? "2"
                          : selectedEnv?.name.toUpperCase().includes("107")
                            ? "4"
                            : selectedEnv?.name.toUpperCase().includes("COCINA")
                              ? "5"
                              : "3"
                    }
                    onCancel={() => setEditingRes(null)}
                    onSuccess={() => {
                      setEditingRes(null);
                      setRefreshTrigger((prev) => prev + 1);
                    }}
                  />
                </div>
              </div>
            );
          }

          return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                <div className="bg-sena-blue text-white p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <UserCheck className="w-5 h-5" />
                      Editar / Reasignar Asignación
                    </h3>
                    <p className="text-xs text-blue-100 mt-0.5">
                      {selectedEnv?.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingRes(null)}
                    className="p-1.5 hover:bg-white/10 rounded-full transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase">
                      Instructor o Funcionario Responsable
                    </label>
                    <input
                      type="text"
                      value={editUserSearch}
                      onChange={(e) => setEditUserSearch(e.target.value)}
                      placeholder="Buscar instructor o funcionario..."
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-sena-green outline-none"
                    />
                    <select
                      value={editInstructorId}
                      onChange={(e) => setEditInstructorId(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-sena-green outline-none"
                    >
                      <option value="">Seleccione un responsable...</option>
                      {assignableUsers
                        .filter((u) => {
                          if (!editUserSearch.trim()) return true;
                          const q = editUserSearch.toLowerCase();
                          return (
                            (u.full_name || "").toLowerCase().includes(q) ||
                            (u.username || "").toLowerCase().includes(q) ||
                            (u.job_category || "").toLowerCase().includes(q)
                          );
                        })
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} —{" "}
                            {u.job_category
                              ? u.job_category.toUpperCase()
                              : u.employment_type || "Funcionario"}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sena-green" />
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={editAssignmentDate}
                        onChange={(e) => setEditAssignmentDate(e.target.value)}
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-sena-green outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-sena-green" />
                        Jornada / Bloque
                      </label>
                      <select
                        value={editTimeBlock}
                        onChange={(e) =>
                          setEditTimeBlock(e.target.value as TimeBlock)
                        }
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-sena-green outline-none"
                      >
                        {(Object.keys(TIME_BLOCKS) as TimeBlock[]).map(
                          (blockKey) => (
                            <option key={blockKey} value={blockKey}>
                              {TIME_BLOCKS[blockKey].label} (
                              {TIME_BLOCKS[blockKey].range})
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRes(null)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={savingAssignmentEdit || !editInstructorId}
                    onClick={async () => {
                      if (!editInstructorId || !editAssignmentDate) return;
                      setSavingAssignmentEdit(true);
                      const res = await updateInstructorAssignmentAction({
                        id: editingRes.id,
                        instructor_id: editInstructorId,
                        assignment_date: editAssignmentDate,
                        time_block: editTimeBlock,
                      });
                      setSavingAssignmentEdit(false);
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(
                        "Asignación actualizada / reasignada correctamente.",
                      );
                      setEditingRes(null);
                      setRefreshTrigger((prev) => prev + 1);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-sena-green rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {savingAssignmentEdit ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* MODAL PARA ORDENAR Y FIJAR PESTAÑAS (EXCLUSIVO COORDINACIONES Y SUPERADMIN) */}
      {isOrderModalOpen && canReorderTabs && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95">
            <div className="bg-sena-blue text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-sena-green" />
                  Orden Fijo de Pestañas de Ambientes
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Exclusivo para Coordinaciones y SuperAdmin. El orden guardado
                  quedará fijo para todos los usuarios.
                </p>
              </div>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2 flex-1 bg-slate-50/60">
              {draftOrderEnvList.map((env, idx) => {
                const isDisabled = globalConfig.disabled_area_ids.includes(
                  env.id,
                );
                return (
                  <div
                    key={env.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                      isDisabled
                        ? "bg-red-50/60 border-red-200"
                        : "bg-white border-slate-200 hover:border-sena-blue/40 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-sena-blue/10 text-sena-blue font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-2">
                          {env.name}
                          {isDisabled && (
                            <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Inhabilitado
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => pinDraftItemFirst(idx)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-sena-blue bg-blue-50 hover:bg-sena-blue hover:text-white rounded-lg transition flex items-center gap-1 cursor-pointer"
                          title="Fijar de primero"
                        >
                          <Pin className="w-3 h-3" />
                          1°
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveDraftItem(idx, "UP")}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Subir posición"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draftOrderEnvList.length - 1}
                        onClick={() => moveDraftItem(idx, "DOWN")}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Bajar posición"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* REGLA 2: Solo el SuperAdmin tiene el poder de habilitar o deshabilitar espacios */}
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleSuperAdminToggleArea(env.id, isDisabled)
                          }
                          className={`ml-2 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            isDisabled
                              ? "bg-red-600 text-white hover:bg-emerald-600"
                              : "bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-700"
                          }`}
                          title="Exclusivo SuperAdmin: Habilitar / Deshabilitar espacio"
                        >
                          <Power className="w-3.5 h-3.5" />
                          {isDisabled ? "Inhabilitado" : "Habilitado"}
                        </button>
                      ) : (
                        <span
                          className="ml-2 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-400 flex items-center gap-1"
                          title="Solo el SuperAdmin puede habilitar o deshabilitar espacios"
                        >
                          <Lock className="w-3 h-3" />
                          {isDisabled ? "Inhabilitado" : "Activo"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Usa las flechas o el botón <strong>1°</strong> para dejar fijos
                tus ambientes prioritarios al inicio.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingOrder}
                  onClick={handleSaveOrder}
                  className="px-5 py-2 text-xs font-bold text-white bg-sena-green hover:bg-green-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-green-900/10 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {savingOrder ? "Fijando orden..." : "Fijar Orden Permanente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
