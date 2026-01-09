"use client";

import { Key } from "lucide-react";
import { ConfigItem } from "@/app/admin/admin.types";
import { AgentFormData } from "../hooks/useUserManagement";

// UserAgent removed in favor of Agent from types + Form Data intersection

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  newAgent: AgentFormData;
  setNewAgent: (agent: AgentFormData) => void;
  areas: ConfigItem[];
}

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  newAgent,
  setNewAgent,
  areas,
}: UserModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
        <h3 className="font-bold text-xl mb-4 text-gray-800 border-b pb-2">
          {newAgent.isEditing ? "Editar Usuario" : "Nuevo Usuario"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* COLUMNA 1: Datos Personales */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Nombre Completo
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-sena-green outline-none"
                value={newAgent.full_name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, full_name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Usuario
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-sena-green outline-none"
                  value={newAgent.username}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, username: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Rol
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-sena-green outline-none"
                  value={newAgent.role}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, role: e.target.value })
                  }
                >
                  <option value="user">Usuario (Planta)</option>
                  <option value="agent">Técnico de Mesa</option>
                  <option value="admin">Administrador</option>
                  <option value="superadmin">Super Admin (Root)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Contraseña
              </label>
              {newAgent.role === "user" ? (
                <div className="p-2 bg-gray-100 text-gray-500 rounded-lg text-sm italic border border-gray-200">
                  No requiere (Default: Sena2024*)
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 pl-8 font-mono text-sm focus:ring-2 focus:ring-sena-green outline-none"
                    value={newAgent.password || ""}
                    onChange={(e) =>
                      setNewAgent({
                        ...newAgent,
                        password: e.target.value,
                      })
                    }
                    placeholder="Asignar clave..."
                  />
                  <Key className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Vinculación
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-sena-green outline-none"
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
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Tipo Cargo
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-sena-green outline-none"
                  value={newAgent.job_category || "funcionario"}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, job_category: e.target.value })
                  }
                >
                  <option value="funcionario">Administrativo</option>
                  <option value="instructor">Instructor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Área / Ubicación
              </label>
              <select
                value={newAgent.area || ""}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, area: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-sena-green outline-none"
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

          {/* COLUMNA 2: Permisos y Opciones */}
          <div className="space-y-4">
            {/* PERMISOS DE ASSETS */}
            {(newAgent.role === "agent" ||
              newAgent.role === "admin" ||
              newAgent.role === "superadmin") && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-bold text-gray-500 uppercase mb-3 border-b pb-1">
                  Gestión de Inventario
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={newAgent.perm_create_assets || false}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          perm_create_assets: e.target.checked,
                        })
                      }
                      className="rounded text-sena-green focus:ring-sena-green"
                    />
                    Crear Activos
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={newAgent.perm_transfer_assets || false}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          perm_transfer_assets: e.target.checked,
                        })
                      }
                      className="rounded text-sena-green focus:ring-sena-green"
                    />
                    Trasladar Activos
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={newAgent.perm_decommission_assets || false}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          perm_decommission_assets: e.target.checked,
                        })
                      }
                      className="rounded text-sena-green focus:ring-sena-green"
                    />
                    Dar de Baja Activos
                  </label>
                </div>
              </div>
            )}

            {/* PERMISOS DE COORDINACIÓN */}
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
              <p className="text-xs font-bold text-purple-700 uppercase mb-3 border-b border-purple-200 pb-1">
                Coordinación
              </p>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-purple-100 p-1 rounded transition">
                <input
                  type="checkbox"
                  checked={newAgent.perm_manage_assignments || false}
                  onChange={(e) =>
                    setNewAgent({
                      ...newAgent,
                      perm_manage_assignments: e.target.checked,
                    })
                  }
                  className="rounded text-purple-600 focus:ring-purple-600"
                />
                Gestionar Asignaciones
              </label>
            </div>

            {/* OPCIONES AVANZADAS */}
            <div className="pt-2">
              <label className="flex items-center gap-2 text-sm font-bold text-yellow-600 cursor-pointer bg-yellow-50 p-2 rounded border border-yellow-100 hover:bg-yellow-100 transition">
                <input
                  type="checkbox"
                  checked={newAgent.is_vip}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, is_vip: e.target.checked })
                  }
                  className="rounded text-yellow-500 focus:ring-yellow-500"
                />
                Usuario VIP (Prioridad Alta)
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-sena-green text-white rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-900/20"
          >
            {newAgent.isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}
