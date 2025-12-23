"use client";

import { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Users,
  Shield,
  ShieldOff,
} from "lucide-react"; // Added Icons for better visual hierarchy
import { User } from "@/app/admin/types";

interface ContractorsTabProps {
  users: User[];
  onRefresh: () => void;
  currentUserRole?: string;
}

export default function ContractorsTab({
  users,
  onRefresh,
  currentUserRole,
}: ContractorsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"contractors" | "planta">(
    "contractors",
  );

  // Filter logic
  const contractors = users.filter((u) => u.employment_type === "contratista");
  const plantaUsers = users.filter(
    (u) => u.employment_type === "planta" || !u.employment_type,
  );

  const instructors = contractors.filter(
    (u) => u.job_category === "instructor",
  );
  const officials = contractors.filter((u) => u.job_category === "funcionario");

  const plantaInstructors = plantaUsers.filter(
    (u) => u.job_category === "instructor",
  );
  const plantaOfficials = plantaUsers.filter(
    (u) => u.job_category === "funcionario",
  );

  const handleBulkAction = async (job_category: string, enable: boolean) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas ${
          enable ? "HABILITAR" : "DESHABILITAR"
        } el acceso a TODOS los ${job_category}s?`,
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
    <section className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SectionHeader title="Control de Acceso (Usuarios)" />

        {/* SUB-TABS NAVIGATION */}
        <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab("contractors")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
              activeSubTab === "contractors"
                ? "bg-white text-sena-blue shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Contratistas
          </button>
          <button
            onClick={() => setActiveSubTab("planta")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
              activeSubTab === "planta"
                ? "bg-white text-sena-blue shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Planta / Directos
          </button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="w-full max-w-full">
        {activeSubTab === "contractors" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-blue-800 mb-1">
                <Users className="w-4 h-4" />
                <h3 className="font-bold text-sm">
                  Gestión Masiva de Contratistas
                </h3>
              </div>
              <p className="text-xs text-blue-600">
                Permite habilitar o deshabilitar bloques enteros de usuarios
                según su categoría.
              </p>
            </div>

            <ContractorGroup
              title="Instructores"
              subtitle="Contratistas"
              category="instructor"
              users={instructors}
              onBulkAction={handleBulkAction}
              onToggleUser={handleIndividualToggle}
              showBulkActions={true}
              currentUserRole={currentUserRole}
            />

            <ContractorGroup
              title="Funcionarios"
              subtitle="Contratistas"
              category="funcionario"
              users={officials}
              onBulkAction={handleBulkAction}
              onToggleUser={handleIndividualToggle}
              showBulkActions={true}
              currentUserRole={currentUserRole}
            />
          </div>
        )}

        {activeSubTab === "planta" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-green-50 border border-green-100 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-green-800 mb-1">
                <Shield className="w-4 h-4" />
                <h3 className="font-bold text-sm">
                  Gestión Individual de Planta
                </h3>
              </div>
              <p className="text-xs text-green-600">
                Los usuarios de planta deben gestionarse uno a uno por
                seguridad.
              </p>
            </div>

            <ContractorGroup
              title="Instructores"
              subtitle="Planta"
              category="instructor"
              users={plantaInstructors}
              onBulkAction={() => {}}
              onToggleUser={handleIndividualToggle}
              showBulkActions={false}
              currentUserRole={currentUserRole}
            />

            <ContractorGroup
              title="Funcionarios"
              subtitle="Planta"
              category="funcionario"
              users={plantaOfficials}
              onBulkAction={() => {}}
              onToggleUser={handleIndividualToggle}
              showBulkActions={false}
              currentUserRole={currentUserRole}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// --- SUBCOMPONENTS ---

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-2xl font-bold text-gray-800 tracking-tight break-words">
      {title}
    </h2>
  );
}

function ContractorGroup({
  title,
  subtitle,
  category,
  users,
  onBulkAction,
  onToggleUser,
  showBulkActions = true,
  currentUserRole,
}: {
  title: string;
  subtitle: string;
  category: string;
  users: User[];
  onBulkAction: (cat: string, en: boolean) => void;
  onToggleUser: (u: User) => void;
  showBulkActions?: boolean;
  currentUserRole?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-full max-w-full overflow-hidden transition-shadow hover:shadow-md">
      {/* HEADER: Designed to wrap and never overflow */}
      <div
        className="p-4 cursor-pointer bg-gray-50 active:bg-gray-100 transition duration-150 ease-in-out"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* TITLE SECTION */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm flex-shrink-0">
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-sena-blue" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-gray-800 leading-tight truncate">
                {title}
              </h3>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">
                {subtitle} • {users.length} Usuarios
              </p>
            </div>
          </div>

          {/* ACTIONS SECTION (Only if Bulk Actions Enabled) */}
          {showBulkActions && currentUserRole !== "admin" && (
            <div
              className="flex items-center gap-3 self-end sm:self-auto bg-white p-1.5 rounded-lg border border-gray-100 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-r border-gray-100">
                Masivo
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onBulkAction(category, true)}
                  className="p-1.5 rounded-md hover:bg-green-50 text-gray-400 hover:text-green-600 transition"
                  title="Habilitar Todos"
                >
                  <Shield className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onBulkAction(category, false)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                  title="Deshabilitar Todos"
                >
                  <ShieldOff className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT: Accordion Body */}
      {isOpen && (
        <div className="border-t border-gray-100 p-4">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Filtrar por nombre o usuario..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sena-green/50 focus:border-sena-green transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* User List */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 flex flex-col items-center">
              <Users className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No se encontraron usuarios.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onToggle={() => onToggleUser(user)}
                  currentUserRole={currentUserRole}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserCard({
  user,
  onToggle,
  currentUserRole,
}: {
  user: User;
  onToggle: () => void;
  currentUserRole?: string;
}) {
  return (
    <div
      className={`
            flex items-center justify-between p-3 rounded-xl border transition-all duration-200 group
            ${
              user.is_active
                ? "bg-white border-gray-200 hover:border-sena-green/30 hover:shadow-sm"
                : "bg-gray-50 border-transparent opacity-75 hover:opacity-100"
            }
         `}
    >
      <div className="min-w-0 flex-1 pr-3">
        <p
          className={`text-sm font-bold truncate transition-colors ${
            user.is_active ? "text-gray-700" : "text-gray-500 line-through"
          }`}
        >
          {user.full_name}
        </p>
        <p className="text-xs text-gray-400 truncate font-mono">
          @{user.username}
        </p>
      </div>

      <button
        onClick={onToggle}
        disabled={currentUserRole === "admin"}
        className={`
               relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sena-green focus:ring-offset-2
               ${user.is_active ? "bg-sena-green" : "bg-gray-200"}
               ${
                 currentUserRole === "admin"
                   ? "cursor-not-allowed opacity-50"
                   : "cursor-pointer"
               }
            `}
        role="switch"
        aria-checked={user.is_active}
      >
        <span
          className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${user.is_active ? "translate-x-5" : "translate-x-0"}
               `}
        />
      </button>
    </div>
  );
}
