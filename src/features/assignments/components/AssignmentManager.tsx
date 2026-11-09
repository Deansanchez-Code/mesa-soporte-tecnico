"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Plus, MapPin, X, UserCheck, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import BulkAssignmentModal from "./BulkAssignmentModal";
import CalendarView from "./CalendarView";
import { Assignment } from "../types";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import {
  getAssignableUsersAction,
  AssignableUser,
  updateInstructorAssignmentAction,
} from "@/features/reservations/actions/reservationActions";
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

  const fetchEnvironments = async () => {
    setLoading(true);
    // Fetch AMBIENTE, AUDITORIO, SUBDIRECCIÓN, BIBLIOTECA and COCINA, excluding KIOSKO
    const { data } = await supabase
      .from("areas")
      .select("id, name")
      .or(
        "name.ilike.%AMBIENTE%,name.ilike.%AUDITORIO%,name.ilike.%SUBDIRECCIÓN%,name.ilike.%BIBLIOTECA%,name.ilike.%COCINA%",
      )
      .not("name", "ilike", "%KIOSKO%")
      .order("name");

    if (data) {
      // Filter out "AMBIENTE DE INSTRUCTORES"
      const filtered = data.filter(
        (d) => !d.name.toUpperCase().includes("AMBIENTE DE INSTRUCTORES"),
      );

      // --- RBAC Filter for Subdirección ---
      const u = user as { employment_type?: string; role?: string };
      const empType = (u?.employment_type || "").toLowerCase();
      const isOfficial =
        empType.includes("planta") ||
        empType.includes("funcionario") ||
        empType.includes("oficial");
      const isAdmin = ["admin", "superadmin"].includes(
        (u?.role || "").toLowerCase(),
      );

      const rbacFiltered = filtered.filter((d) => {
        if (d.name.toUpperCase().includes("SUBDIRECCIÓN")) {
          return isOfficial || isAdmin;
        }
        return true;
      });

      const mapped = rbacFiltered
        .map((d: { id: number; name: string }) => ({
          id: d.id,
          name: d.name,
          type: "AREA",
          capacity: 0,
        }))
        .sort((a, b) => {
          // Prioritize AUDITORIO, BIBLIOTECA and SUBDIRECCIÓN
          const aPriority = a.name.toUpperCase().includes("AUDITORIO")
            ? 1
            : a.name.toUpperCase().includes("BIBLIOTECA")
              ? 2
              : a.name.toUpperCase().includes("SUBDIRECCIÓN")
                ? 3
                : 4;
          const bPriority = b.name.toUpperCase().includes("AUDITORIO")
            ? 1
            : b.name.toUpperCase().includes("BIBLIOTECA")
              ? 2
              : b.name.toUpperCase().includes("SUBDIRECCIÓN")
                ? 3
                : 4;

          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.name.localeCompare(b.name);
        });

      setEnvironments(mapped);
      if (mapped.length > 0 && !selectedEnvId) {
        setSelectedEnvId(mapped[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEnvironments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
      {/* HEADER: Tabs de Ambientes */}
      <div className="border-b border-gray-100 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapPin className="text-sena-green" />
            Gestión de Ambientes
          </h2>
          {(canManage ||
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
                  selectedEnv?.name.toUpperCase().includes("SUBDIRECCIÓN") ||
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
                    const isAdmin = ["admin", "superadmin"].includes(userRole);

                    if (!isVip && !isAdmin) {
                      toast.error(
                        "Solo el personal VIP puede realizar reservas en Subdirección.",
                      );
                      return;
                    }
                  }

                  // Specific RBAC for Biblioteca Button
                  if (selectedEnv?.name.toUpperCase().includes("BIBLIOTECA")) {
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

                    const isAdmin = ["admin", "superadmin"].includes(userRole);
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
              className="bg-sena-green text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-900/20"
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

        {/* Scrollable Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-gray-200">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnvId(env.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedEnvId === env.id
                  ? "bg-blue-50 text-sena-blue border border-blue-200 shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
              }`}
            >
              {env.name}
            </button>
          ))}
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
    </div>
  );
}
