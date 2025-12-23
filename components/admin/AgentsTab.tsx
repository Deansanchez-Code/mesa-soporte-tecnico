"use client";

import { useState } from "react";
import { UserPlus, Search, Edit, Trash2 } from "lucide-react";
import { Agent, ConfigItem } from "@/app/admin/types";
import { useUserManagement } from "@/hooks/useUserManagement";
import UserModal from "@/components/admin/UserModal";

interface AgentsTabProps {
  agents: Agent[];
  onRefresh: () => void;
  configData: {
    areas: ConfigItem[];
  };
  currentUserRole?: string;
}

export default function AgentsTab({
  agents,
  onRefresh,
  configData,
  currentUserRole,
}: AgentsTabProps) {
  const {
    showAgentModal,
    setShowAgentModal,
    newAgent,
    setNewAgent,
    handleCreateOrUpdateUser,
    handleEditUser,
    handleDeleteUser,
    resetUserForm,
  } = useUserManagement(onRefresh);

  const [searchTerm, setSearchTerm] = useState("");

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          Gestión de Usuarios (Técnicos y Admins)
        </h2>
        {currentUserRole !== "admin" && (
          <button
            onClick={() => {
              resetUserForm();
              setNewAgent({ ...newAgent, role: "agent" });
              setShowAgentModal(true);
            }}
            className="bg-sena-blue hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" /> Nuevo Usuario
          </button>
        )}
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por nombre, usuario o rol..."
          className="w-full pl-10 p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sena-blue outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Nombre
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Usuario
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Email
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Rol
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Área
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Permisos
              </th>
              {currentUserRole !== "admin" && (
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agents
              .filter(
                (a) =>
                  a.full_name
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                  a.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.role.toLowerCase().includes(searchTerm.toLowerCase()),
              )
              .map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="p-4 text-sm font-bold text-gray-800">
                    {agent.full_name}
                    {agent.is_vip && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded border border-yellow-200">
                        VIP
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {agent.username}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {agent.email || "N/A"}
                  </td>
                  <td className="p-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        agent.role === "superadmin"
                          ? "bg-purple-100 text-purple-700"
                          : agent.role === "admin"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {agent.role === "superadmin"
                        ? "Super Admin"
                        : agent.role === "admin"
                          ? "Admin"
                          : "Técnico"}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {agent.area || "N/A"}
                  </td>
                  <td className="p-4 text-xs text-gray-500">
                    <div className="flex gap-1 flex-wrap">
                      {agent.role === "superadmin" || agent.role === "admin" ? (
                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold">
                          Control Total
                        </span>
                      ) : (
                        <>
                          {agent.perm_create_assets && (
                            <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                              Crear
                            </span>
                          )}
                          {agent.perm_transfer_assets && (
                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              Trasladar
                            </span>
                          )}
                          {agent.perm_decommission_assets && (
                            <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-100">
                              Bajas
                            </span>
                          )}
                          {!agent.perm_create_assets &&
                            !agent.perm_transfer_assets &&
                            !agent.perm_decommission_assets && (
                              <span className="text-gray-400 italic">
                                Ninguno
                              </span>
                            )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    {currentUserRole !== "admin" && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(agent)}
                          className="p-1 hover:bg-gray-100 rounded text-blue-600 transition"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(agent.id)}
                          className="p-1 hover:bg-gray-100 rounded text-red-600 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <UserModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        onSave={handleCreateOrUpdateUser}
        newAgent={newAgent}
        setNewAgent={setNewAgent}
        areas={configData.areas}
      />
    </section>
  );
}
