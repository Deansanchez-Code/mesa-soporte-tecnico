"use client";

import { Key, ShieldCheck } from "lucide-react";
import { ConfigItem } from "@/app/admin/admin.types";
import { AgentFormData } from "../hooks/useUserManagement";
import { NativeDialog } from "@/components/ui/NativeDialog";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  newAgent: AgentFormData;
  setNewAgent: (agent: AgentFormData) => void;
  areas: ConfigItem[];
  currentUserRole?: string;
}

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  newAgent,
  setNewAgent,
  areas,
  currentUserRole,
}: UserModalProps) {
  if (!isOpen) return null;
  const isSuperAdmin = (currentUserRole || "").toLowerCase() === "superadmin";
  const roleLower = (newAgent.role || "user").toLowerCase();
  const requiresPasswordCredential = ["agent", "admin", "superadmin"].includes(
    roleLower,
  );

  return (
    <NativeDialog
      isOpen={isOpen}
      onClose={onClose}
      title={newAgent.isEditing ? "Editar Usuario" : "Nuevo Usuario"}
      subtitle="Directorio Institucional & Control de Acceso"
      badgeText="GOV·SENA·IAM"
      headerIcon={<ShieldCheck className="w-5 h-5 text-emerald-300" />}
      maxWidthClass="max-w-3xl"
    >
      <div className="bento-grid-swiss grid grid-cols-1 md:grid-cols-2 rounded-none border-0">
        {/* CELDA BENTO 01: Datos Personales */}
        <div className="bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="swiss-section-tag">
              01 / IDENTIDAD &amp; VINCULACIÓN
            </span>
            <span className="tabular-mono text-[11px] text-[#043263] font-bold">
              SENA·ID
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Nombre Completo
            </label>
            <input
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#39A900] outline-none"
              value={newAgent.full_name}
              onChange={(e) =>
                setNewAgent({ ...newAgent, full_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Usuario / Documento
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm tabular-mono focus:ring-2 focus:ring-[#39A900] outline-none"
                value={newAgent.username}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, username: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Rol del Sistema
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#39A900] outline-none bg-white"
                value={requiresPasswordCredential ? roleLower : "user"}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, role: e.target.value })
                }
              >
                <option value="user">Usuario (Planta)</option>
                {isSuperAdmin && (
                  <option value="agent">Técnico de Mesa (Soporte)</option>
                )}
                <option value="admin">Administrador</option>
                {isSuperAdmin && (
                  <option value="superadmin">Super Admin (Root)</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Credencial de Acceso
            </label>
            {!requiresPasswordCredential ? (
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg text-xs border border-slate-200 leading-relaxed">
                Acceso Kiosko sin contraseña compartida: PIN numérico de 6
                dígitos para VIP/Coordinadores, ingreso directo institucional u
                OTP a correo personal externo.
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-2.5 pl-8 tabular-mono text-sm focus:ring-2 focus:ring-[#39A900] outline-none"
                  value={newAgent.password || ""}
                  onChange={(e) =>
                    setNewAgent({
                      ...newAgent,
                      password: e.target.value,
                    })
                  }
                  placeholder="Asignar clave..."
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Vinculación
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#39A900] outline-none bg-white"
                value={newAgent.employment_type || "planta"}
                onChange={(e) =>
                  setNewAgent({
                    ...newAgent,
                    employment_type: e.target.value,
                  })
                }
              >
                <option value="planta">Planta / Directo</option>
                <option value="contratista">Contratista</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Tipo Cargo
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#39A900] outline-none bg-white"
                value={newAgent.job_category || "funcionario"}
                onChange={(e) => {
                  const val = e.target.value;
                  const prevJobCat = (
                    newAgent.job_category || "funcionario"
                  ).toLowerCase();
                  if (val === "coordinador") {
                    setNewAgent({
                      ...newAgent,
                      job_category: val,
                      is_vip: true,
                      perm_manage_assignments: true,
                    });
                  } else if (prevJobCat === "coordinador") {
                    setNewAgent({
                      ...newAgent,
                      job_category: val,
                      is_vip: false,
                      perm_manage_assignments: false,
                      role:
                        roleLower === "coordinator" || roleLower === "vip"
                          ? "user"
                          : newAgent.role,
                    });
                  } else {
                    setNewAgent({ ...newAgent, job_category: val });
                  }
                }}
              >
                <option value="funcionario">Administrativo</option>
                <option value="instructor">Instructor</option>
                <option value="coordinador">Coordinador(a)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Área / Ubicación
            </label>
            <select
              value={newAgent.area || ""}
              onChange={(e) =>
                setNewAgent({ ...newAgent, area: e.target.value })
              }
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#39A900] outline-none bg-white"
            >
              <option value="" disabled>
                Seleccionar Área...
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.name}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CELDA BENTO 02: Permisos y Opciones */}
        <div className="bg-[#F8FAFC] p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="swiss-section-tag">
                02 / PERMISOS &amp; COORDINACIÓN
              </span>
              <span className="tabular-mono text-[11px] text-emerald-700 font-bold">
                RBAC·RLS
              </span>
            </div>

            {/* PERMISOS DE ASSETS */}
            {(newAgent.role === "agent" ||
              newAgent.role === "admin" ||
              newAgent.role === "superadmin") && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-600 uppercase mb-2.5 border-b border-slate-100 pb-1.5">
                  Gestión de Inventario
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={newAgent.perm_create_assets || false}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          perm_create_assets: e.target.checked,
                        })
                      }
                      className="rounded text-[#39A900] focus:ring-[#39A900] w-4 h-4"
                    />
                    Crear Activos
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={newAgent.perm_transfer_assets || false}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          perm_transfer_assets: e.target.checked,
                        })
                      }
                      className="rounded text-[#39A900] focus:ring-[#39A900] w-4 h-4"
                    />
                    Trasladar Activos
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={newAgent.perm_decommission_assets || false}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          perm_decommission_assets: e.target.checked,
                        })
                      }
                      className="rounded text-[#39A900] focus:ring-[#39A900] w-4 h-4"
                    />
                    Dar de Baja Activos
                  </label>
                </div>
              </div>
            )}

            {/* PERMISOS DE COORDINACIÓN */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <p className="text-xs font-bold text-[#043263] uppercase mb-1 border-b border-slate-100 pb-1.5">
                Coordinación y Privilegios
              </p>
              <label className="flex items-start gap-2.5 text-sm text-[#043263] font-bold cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition">
                <input
                  type="checkbox"
                  checked={newAgent.job_category === "coordinador"}
                  onChange={(e) => {
                    const isCoord = e.target.checked;
                    setNewAgent({
                      ...newAgent,
                      job_category: isCoord ? "coordinador" : "funcionario",
                      is_vip: isCoord,
                      perm_manage_assignments: isCoord,
                      role:
                        !isCoord &&
                        (roleLower === "coordinator" || roleLower === "vip")
                          ? "user"
                          : newAgent.role,
                    });
                  }}
                  className="mt-0.5 rounded text-[#043263] focus:ring-[#043263] w-4 h-4"
                />
                <div>
                  <span>Designar como Coordinador(a) de Planta</span>
                  <p className="text-xs font-normal text-slate-600 leading-relaxed mt-0.5">
                    Otorga automáticamente privilegios VIP, autorización de
                    prerreservas y asignación de reservas a
                    instructores/funcionarios.
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition">
                <input
                  type="checkbox"
                  checked={newAgent.perm_manage_assignments || false}
                  onChange={(e) =>
                    setNewAgent({
                      ...newAgent,
                      perm_manage_assignments: e.target.checked,
                    })
                  }
                  className="rounded text-[#043263] focus:ring-[#043263] w-4 h-4"
                />
                Gestionar Asignaciones y Ambientes
              </label>
            </div>

            {/* OPCIONES AVANZADAS VIP */}
            <div>
              <label className="flex items-center gap-2.5 text-sm font-bold text-amber-900 cursor-pointer bg-amber-50 p-3 rounded-xl border border-amber-200 hover:bg-amber-100/80 transition">
                <input
                  type="checkbox"
                  checked={newAgent.is_vip}
                  onChange={(e) => {
                    const isVip = e.target.checked;
                    const normalizedRole =
                      !isVip &&
                      (roleLower === "coordinator" || roleLower === "vip")
                        ? "user"
                        : newAgent.role;
                    if (
                      !isVip &&
                      (newAgent.job_category || "").toLowerCase() ===
                        "coordinador"
                    ) {
                      setNewAgent({
                        ...newAgent,
                        is_vip: false,
                        job_category: "funcionario",
                        perm_manage_assignments: false,
                        role: normalizedRole,
                      });
                    } else {
                      setNewAgent({
                        ...newAgent,
                        is_vip: isVip,
                        role: normalizedRole,
                      });
                    }
                  }}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>★ Usuario VIP (Prioridad Alta &amp; PIN Kiosko)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Footer de Acciones Táctiles (>=44px) */}
      <div className="px-5 py-4 bg-white border-t border-slate-200 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 min-h-[44px] px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#39A900] text-white rounded-lg font-bold hover:bg-[#2d8500] active:translate-y-[1px] transition shadow-md"
        >
          {newAgent.isEditing ? "Guardar Cambios" : "Crear Usuario"}
        </button>
      </div>
    </NativeDialog>
  );
}
