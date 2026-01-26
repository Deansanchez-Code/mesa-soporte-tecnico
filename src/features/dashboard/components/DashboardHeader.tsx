"use client";

import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";
import {
  LayoutDashboard,
  Power,
  LogOut,
  BarChart2,
  Shield,
  CalendarRange,
  BookOpen,
  Monitor,
} from "lucide-react";
import Link from "next/link";

interface DashboardHeaderProps {
  currentUser: User | null;
  profile: UserProfile["profile"];
  role: string | null;
  isAvailable: boolean;
  toggleAvailability: () => void;
  setShowCreateAssetModal: (show: boolean) => void;
  handleLogout: () => void;
  viewMode: string;
  setViewMode: (mode: "KANBAN" | "HISTORY" | "ENVIRONMENTS") => void;
  setShowProfileModal: (show: boolean) => void;
  setShowMetricsModal: (show: boolean) => void;
}

export default function DashboardHeader({
  currentUser,
  profile,
  role,
  isAvailable,
  toggleAvailability,
  setShowCreateAssetModal,
  handleLogout,
  viewMode,
  setViewMode,
  setShowProfileModal,
  setShowMetricsModal,
}: DashboardHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-sena-green p-2 rounded-lg shadow-sm">
          <LayoutDashboard className="text-white w-6 h-6" />
        </div>
        <h1 className="font-bold text-sena-blue text-xl tracking-tight hidden sm:block">
          Mesa de Ayuda <span className="text-sena-green">TIC</span>
          {currentUser && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              |{" "}
              {(profile?.full_name as string) ||
                currentUser.user_metadata?.full_name ||
                currentUser.email ||
                "Usuario"}
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* BOTÓN GESTIÓN ACTIVOS (Si tiene permiso) */}
        {(currentUser?.user_metadata as { perm_create_assets?: boolean })
          ?.perm_create_assets && (
          <button
            onClick={() => setShowCreateAssetModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sena-blue bg-blue-50 hover:bg-blue-100 transition-all border border-blue-200"
            title="Registrar Nuevo Activo"
          >
            <Monitor className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo Activo</span>
          </button>
        )}

        {(role === "admin" || role === "superadmin") && (
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all border cursor-pointer bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 shadow-sm"
            title="Volver al Panel Admin"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Admin Panel</span>
          </Link>
        )}
        <button
          onClick={toggleAvailability}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all border cursor-pointer ${
            isAvailable
              ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200 shadow-sm"
              : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
          }`}
          title="Cambiar estado de disponibilidad"
        >
          <Power className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isAvailable ? "DISPONIBLE" : "NO DISPONIBLE"}
          </span>
        </button>

        {/* TAB: AMBIENTES */}
        <button
          onClick={() => setViewMode("ENVIRONMENTS")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold transition-all ${
            viewMode === "ENVIRONMENTS"
              ? "bg-purple-100 text-purple-700 shadow-sm"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <CalendarRange className="w-5 h-5" />
          <span className="hidden sm:inline">Ambientes</span>
        </button>
        <Link
          href="/dashboard/knowledge"
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-100"
          title="Ver Repositorio de Soporte"
        >
          <BookOpen className="w-5 h-5 text-sena-green" />
          <span className="hidden sm:inline">Repositorio</span>
        </Link>

        <button
          onClick={() => setShowProfileModal(true)}
          className="h-9 w-9 rounded-full bg-sena-blue flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white ring-2 ring-gray-100 hover:ring-sena-green transition-all cursor-pointer"
          title="Tu Perfil"
        >
          {currentUser?.user_metadata?.full_name
            ? ((currentUser.user_metadata?.full_name as string) || "")
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "AG"}
        </button>

        <button
          onClick={() => setShowMetricsModal(true)}
          className="p-2 text-gray-400 hover:text-sena-blue hover:bg-blue-50 rounded-full transition-colors"
          title="Ver Mis Métricas"
        >
          <BarChart2 className="w-5 h-5" />
        </button>

        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
          title="Cerrar Sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
