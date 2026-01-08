import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { AuditLog } from "@/app/admin/admin.types";
import { Search, Loader2, Filter } from "lucide-react";

export default function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*, users(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (actionFilter !== "ALL") {
      query = query.eq("action", actionFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching audit logs:", error);
    } else {
      setLogs(data as unknown as AuditLog[]);
    }
    setLoading(false);
  }, [actionFilter]);

  useEffect(() => {
    // eslint-disable-next-line
    fetchLogs();
  }, [fetchLogs]);

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.users?.full_name?.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search) ||
      log.resource?.toLowerCase().includes(search) ||
      (log.details as { description?: string })?.description
        ?.toLowerCase()
        .includes(search)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          Logs de Auditoría
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
            Últimos 50
          </span>
        </h2>

        <div className="flex gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por usuario, acción..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="ALL">Todas las Acciones</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE_TICKET">CREATE_TICKET</option>
              <option value="UPDATE_STATUS">UPDATE_STATUS</option>
              {uniqueActions.map(
                (a) =>
                  !["LOGIN", "CREATE_TICKET", "UPDATE_STATUS"].includes(a) && (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ),
              )}
            </select>
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchLogs}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition"
            title="Recargar"
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                  Usuario
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                  Acción
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                  Recurso
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Cargando logs...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("es-CO")}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800">
                          {log.users?.full_name || "Sistema / Desconocido"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {log.users?.email}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                            ${
                              log.action === "LOGIN"
                                ? "bg-blue-100 text-blue-700"
                                : log.action.includes("DELETE")
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                            }
                        `}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-600">
                      {log.resource}{" "}
                      <span className="text-gray-400">#{log.resource_id}</span>
                    </td>
                    <td className="p-4 text-xs text-gray-500 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No se encontraron registros de auditoría.
                    <br />
                    <span className="text-xs text-red-400 mt-2 block">
                      (Si acabas de desplegar, asegúrate de haber corrido el
                      script SQL)
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
