"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { User } from "@/app/admin/admin.types";
import {
  format,
  differenceInMinutes,
  parseISO,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Filter,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface WorkSession {
  id: string;
  user_id: string;
  session_start: string;
  session_end?: string;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
  is_overtime: boolean;
  users?: { full_name: string; username: string };
}

export default function ShiftsReportTab() {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd"),
  );

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch("/api/admin/users?limit=100", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.ok) {
          setUsers((data.users || []).filter((u: User) => u.role === "agent"));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUsers();
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("work_sessions")
        .select(
          `
          *,
          users:user_id ( full_name, username )
        `,
        )
        .gte("session_start", startDate)
        .lte("session_start", endDate + "T23:59:59")
        .order("session_start", { ascending: false });

      if (selectedUser !== "ALL") {
        query = query.eq("user_id", selectedUser);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSessions(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando reportes");
    } finally {
      setLoading(false);
    }
  }, [selectedUser, startDate, endDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const formatDuration = (start: string, end?: string) => {
    if (!end) return "En curso...";
    const mins = differenceInMinutes(parseISO(end), parseISO(start));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const exportCSV = () => {
    if (!sessions.length) return;

    const headers = "Agente,Fecha,Inicio,Fin,Duración,IP,Dispositivo,Notas\n";
    const rows = sessions
      .map((s) => {
        const duration = s.session_end
          ? differenceInMinutes(
              parseISO(s.session_end),
              parseISO(s.session_start),
            ) / 60
          : 0;

        return [
          s.users?.full_name || "Unknown",
          format(parseISO(s.session_start), "yyyy-MM-dd"),
          format(parseISO(s.session_start), "HH:mm"),
          s.session_end ? format(parseISO(s.session_end), "HH:mm") : "En curso",
          duration.toFixed(2),
          s.ip_address || "N/A",
          s.user_agent || "N/A",
          s.is_overtime ? "Horas Extras" : "",
        ].join(",");
      })
      .join("\n");

    const blob = new Blob([`\uFEFF${headers}${rows}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_asistencia_${startDate}_${endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
            Agente
          </label>
          <div className="relative">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-48 pl-8 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 outline-none appearance-none"
            >
              <option value="ALL">Todos los Agentes</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
            <Filter className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
            Desde
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div className="flex-1 text-right">
          <button
            onClick={exportCSV}
            disabled={!sessions.length}
            className="inline-flex items-center gap-2 bg-sena-green/10 text-sena-green hover:bg-sena-green/20 px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Agente</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Sesión</th>
                <th className="px-6 py-3">Duración</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Cargando datos...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No se encontraron registros en este periodo.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {session.users?.full_name || "Usuario Desconocido"}
                      <div className="text-xs text-gray-500">
                        {session.users?.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(parseISO(session.session_start), "PPP", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          {format(parseISO(session.session_start), "HH:mm")}
                        </span>
                        {session.session_end && (
                          <span className="flex items-center gap-1 text-red-500 font-medium text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            {format(parseISO(session.session_end), "HH:mm")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700">
                      {formatDuration(
                        session.session_start,
                        session.session_end,
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {session.is_overtime ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          Horas Extras
                        </span>
                      ) : session.session_end ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Completado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold animate-pulse">
                          <Clock className="w-3 h-3" />
                          Activo
                        </span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate"
                      title={session.user_agent}
                    >
                      <div className="flex flex-col">
                        <span>IP: {session.ip_address}</span>
                        <span className="truncate opacity-75">
                          {session.device_fingerprint || "Sin huella"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
