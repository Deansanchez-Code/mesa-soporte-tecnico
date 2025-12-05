"use client";

import { Key } from "lucide-react";
import { ConfigItem } from "@/app/admin/types";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newAgent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setNewAgent: (agent: any) => void;
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
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
        <h3 className="font-bold text-xl mb-4 text-gray-800">
          {newAgent.isEditing ? "Editar Usuario" : "Nuevo Usuario"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Nombre Completo
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg p-2"
              value={newAgent.fullName}
              onChange={(e) =>
                setNewAgent({ ...newAgent, fullName: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Usuario
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2"
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
                className="w-full border border-gray-300 rounded-lg p-2"
                value={newAgent.role}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, role: e.target.value })
                }
              >
                <option value="user">Usuario (Planta)</option>
                <option value="agent">Técnico de Mesa</option>
                <option value="admin">Super Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Contraseña
            </label>
            {newAgent.role === "user" ? (
              <div className="p-2 bg-gray-100 text-gray-500 rounded-lg text-sm italic border border-gray-200">
                No requiere contraseña (se asignará una por defecto)
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text" // Visible para facilitar gestión
                  className="w-full border border-gray-300 rounded-lg p-2 pl-8 font-mono text-sm"
                  value={newAgent.password}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, password: e.target.value })
                  }
                  placeholder="Asignar clave..."
                />
                <Key className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Tipo de Vinculación
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2"
              value={newAgent.employment_type || "planta"}
              onChange={(e) =>
                setNewAgent({ ...newAgent, employment_type: e.target.value })
              }
            >
              <option value="planta">Planta / Directo</option>
              <option value="contratista">Contratista</option>
            </select>
          </div>

          {newAgent.employment_type === "contratista" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Categoría (Contratistas)
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2"
                value={newAgent.job_category || "funcionario"}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, job_category: e.target.value })
                }
              >
                <option value="funcionario">
                  Funcionario (Apoyo Administrativo/Otros)
                </option>
                <option value="instructor">Instructor</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Área
            </label>
            <select
              value={newAgent.area}
              onChange={(e) =>
                setNewAgent({ ...newAgent, area: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg p-2"
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

          {/* PERMISOS ADICIONALES (Solo si es Agente/Admin) */}
          {(newAgent.role === "agent" || newAgent.role === "admin") && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                Permisos Especiales
              </p>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAgent.perm_create_assets}
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
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAgent.perm_transfer_assets}
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
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAgent.perm_decommission_assets}
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
          )}

          {/* OPCIONES AVANZADAS */}
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm font-bold text-yellow-600 cursor-pointer">
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
    </div>
  );
}
