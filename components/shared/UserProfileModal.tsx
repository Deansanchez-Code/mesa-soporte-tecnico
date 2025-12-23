"use client";

import { User } from "@/app/admin/types";
import {
  X,
  Camera,
  Mail,
  Shield,
  MapPin,
  Briefcase,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  startOfWeek,
  startOfDay,
  isAfter,
  differenceInMinutes,
} from "date-fns";

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
}

export default function UserProfileModal({
  user,
  onClose,
}: UserProfileModalProps) {
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [stats, setStats] = useState({
    todayMinutes: 0,
    weekMinutes: 0,
    overtimeMinutes: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.id) return;

      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();

      const { data: sessions } = await supabase
        .from("work_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("session_start", weekStart); // Fetch week data

      if (sessions) {
        let dayMins = 0;
        let weekMins = 0;
        let overtimeMins = 0;

        sessions.forEach((session) => {
          const start = new Date(session.session_start);
          const end = session.session_end
            ? new Date(session.session_end)
            : new Date(); // If ongoing, calc until now

          const duration = differenceInMinutes(end, start);

          // Week total
          weekMins += duration;

          // Today total
          if (
            isAfter(start, new Date(todayStart)) ||
            start.toISOString() === todayStart
          ) {
            dayMins += duration;
          }

          // Overtime (Flagged in DB or calculated? For now rely on flag or simple metric)
          if (session.is_overtime) {
            overtimeMins += duration;
          }
        });

        setStats({
          todayMinutes: dayMins,
          weekMinutes: weekMins,
          overtimeMinutes: overtimeMins,
          loading: false,
        });
      } else {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [user.id]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "admin":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "agent":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 relative">
        {/* Header Decorativo */}
        <div className="h-24 bg-gradient-to-r from-sena-green to-green-600 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Perfil */}
        <div className="px-6 pb-6 relative">
          {/* Avatar con opción de editar */}
          <div className="relative -mt-12 mb-4 flex justify-center">
            <div
              className="relative group cursor-pointer"
              onMouseEnter={() => setIsHoveringAvatar(true)}
              onMouseLeave={() => setIsHoveringAvatar(false)}
              onClick={() =>
                alert("Funcionalidad de carga de imagen próximamente...")
              }
            >
              <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
                <div className="w-full h-full rounded-full bg-sena-blue flex items-center justify-center text-white text-3xl font-bold border-4 border-white">
                  {getInitials(user.full_name || "Usuario")}
                </div>
              </div>

              {/* Overlay de Edición */}
              <div
                className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white transition-opacity duration-200 ${
                  isHoveringAvatar ? "opacity-100" : "opacity-0"
                }`}
              >
                <Camera className="w-8 h-8" />
              </div>
              <div className="absolute bottom-1 right-1 bg-white rounded-full p-1.5 shadow-md text-gray-500 hover:text-sena-blue transition-colors">
                <Camera className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              {user.full_name || "Usuario"}
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              {user.username || "user"}
            </p>
            <div className="mt-2 flex justify-center">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${getRoleBadgeColor(
                  user.role || "user",
                )}`}
              >
                <Shield className="w-3 h-3" />
                {(user.role || "user").toUpperCase()}
              </span>
            </div>
          </div>

          {/* Estadísticas de Asistencia */}
          {(user.role === "agent" || user.role === "admin") && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs font-bold uppercase">Hoy</span>
                </div>
                <div className="text-lg font-bold text-blue-800">
                  {stats.loading ? "..." : formatHours(stats.todayMinutes)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                  <CalendarDays className="w-3 h-3" />
                  <span className="text-xs font-bold uppercase">Semana</span>
                </div>
                <div className="text-lg font-bold text-green-800">
                  {stats.loading ? "..." : formatHours(stats.weekMinutes)}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="bg-white p-2 rounded-lg shadow-sm text-gray-400">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Correo Electrónico
                </label>
                <p className="text-sm font-medium text-gray-700 break-all">
                  {user.email || "No registrado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="bg-white p-2 rounded-lg shadow-sm text-gray-400">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Ubicación / Área
                </label>
                <p className="text-sm font-medium text-gray-700">
                  {user.area || "No especificada"}
                </p>
              </div>
            </div>

            {(user.employment_type || user.job_category) && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="bg-white p-2 rounded-lg shadow-sm text-gray-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Vinculación
                  </label>
                  <p className="text-sm font-medium text-gray-700">
                    {[user.employment_type, user.job_category]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
