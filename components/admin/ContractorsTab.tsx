"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { User } from "@/app/admin/types";

interface ContractorsTabProps {
  users: User[];
  onRefresh: () => void;
}

export default function ContractorsTab({
  users,
  onRefresh,
}: ContractorsTabProps) {
  // Filter contractors
  const contractors = users.filter((u) => u.employment_type === "contratista");
  const plantaUsers = users.filter(
    (u) => u.employment_type === "planta" || !u.employment_type
  );

  // Contractors Groups
  const instructors = contractors.filter(
    (u) => u.job_category === "instructor"
  );
  const officials = contractors.filter((u) => u.job_category === "funcionario");

  // Planta Groups
  const plantaInstructors = plantaUsers.filter(
    (u) => u.job_category === "instructor"
  );
  const plantaOfficials = plantaUsers.filter(
    (u) => u.job_category === "funcionario"
  );

  const handleBulkAction = async (job_category: string, enable: boolean) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas ${
          enable ? "HABILITAR" : "DESHABILITAR"
        } el acceso a TODOS los ${job_category}s?`
      )
    )
      return;

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: enable ? "enable" : "disable",
          job_category,
          employment_type: "contratista",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      alert(`✅ ${data.message}`);
      onRefresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      } else {
        alert("Error desconocido");
      }
    }
  };

  const handleIndividualToggle = async (user: User) => {
    const newStatus = !user.is_active;
    if (!newStatus && !confirm(`¿Deshabilitar a ${user.full_name}?`)) return;

    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.auth_id || user.id,
          is_active: newStatus,
        }),
      });

      if (!response.ok) throw new Error("Error actualizando estado");
      onRefresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Control de Acceso (Contratistas y Planta)
      </h2>

      {/* --- CONTRATISTAS (Con Acceso Masivo) --- */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">
          Contratistas
        </h3>

        <ContractorGroup
          title="Instructores (Contratistas)"
          category="instructor"
          users={instructors}
          onBulkAction={handleBulkAction}
          onToggleUser={handleIndividualToggle}
          showBulkActions={true}
        />

        <ContractorGroup
          title="Funcionarios (Contratistas)"
          category="funcionario"
          users={officials}
          onBulkAction={handleBulkAction}
          onToggleUser={handleIndividualToggle}
          showBulkActions={true}
        />
      </div>

      {/* --- PLANTA (Solo Individual) --- */}
      <div className="space-y-4 mt-8">
        <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 pt-4">
          Planta / Directos
        </h3>

        <ContractorGroup
          title="Instructores (Planta)"
          category="instructor"
          users={plantaInstructors}
          onBulkAction={() => {}}
          onToggleUser={handleIndividualToggle}
          showBulkActions={false}
        />

        <ContractorGroup
          title="Funcionarios (Planta)"
          category="funcionario"
          users={plantaOfficials}
          onBulkAction={() => {}}
          onToggleUser={handleIndividualToggle}
          showBulkActions={false}
        />
      </div>
    </div>
  );
}

function ContractorGroup({
  title,
  category,
  users,
  onBulkAction,
  onToggleUser,
  showBulkActions = true,
}: {
  title: string;
  category: string;
  users: User[];
  onBulkAction: (cat: string, en: boolean) => void;
  onToggleUser: (u: User) => void;
  showBulkActions?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
      <div
        className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
          <h3 className="font-bold text-lg text-gray-700">
            {title} ({users.length})
          </h3>
        </div>

        {showBulkActions && (
          <div
            className="flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:block">
              Control Masivo
            </span>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => onBulkAction(category, true)}
                className="px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 hover:bg-white hover:text-green-600 text-gray-500"
                title="Habilitar Todos"
              >
                ON
              </button>
              <div className="w-px bg-gray-300 mx-1"></div>
              <button
                onClick={() => onBulkAction(category, false)}
                className="px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 hover:bg-white hover:text-red-600 text-gray-500"
                title="Deshabilitar Todos"
              >
                OFF
              </button>
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="p-4 border-t border-gray-200 animate-in slide-in-from-top-2">
          {/* Search Bar */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`Buscar ${title.toLowerCase()}...`}
              className="w-full pl-9 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-sena-blue outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* List */}
          {filteredUsers.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">
              No se encontraron usuarios
            </p>
          ) : (
            <div className="grid gap-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition bg-white"
                >
                  <div>
                    <p className="font-bold text-sm text-gray-800">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-gray-500">{user.username}</p>
                  </div>

                  <button
                    onClick={() => onToggleUser(user)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      user.is_active ? "bg-sena-green" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`${
                        user.is_active ? "translate-x-6" : "translate-x-1"
                      } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
