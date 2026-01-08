"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import {
  History,
  FileText,
  ArrowRight,
  User,
  ShieldAlert,
  CheckCircle,
  X,
  Download,
} from "lucide-react";

interface AssetLog {
  id: string;
  action_type: "ENTRY" | "TRANSFER" | "DECOMMISSION" | "REACTIVATION";
  previous_user?: { full_name: string };
  new_user?: { full_name: string };
  performed_by_user: { full_name: string };
  authorization_file_url: string;
  comments: string;
  created_at: string;
}

interface AssetHistoryTimelineProps {
  assetId: string; // UUID of the asset
  serialNumber: string;
  onClose: () => void;
}

export default function AssetHistoryTimeline({
  assetId,
  serialNumber,
  onClose,
}: AssetHistoryTimelineProps) {
  const [logs, setLogs] = useState<AssetLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from("asset_logs")
        .select(
          `
          id,
          action_type,
          comments,
          created_at,
          authorization_file_url,
          previous_user:previous_user_id(full_name),
          new_user:new_user_id(full_name),
          performed_by_user:performed_by_user_id(full_name)
        `,
        )
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching logs:", error);
      } else {
        setLogs(data as unknown as AssetLog[]);
      }
      setLoading(false);
    }

    fetchLogs();
  }, [assetId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "ENTRY":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "TRANSFER":
        return <ArrowRight className="w-4 h-4 text-blue-600" />;
      case "DECOMMISSION":
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      case "REACTIVATION":
        return <History className="w-4 h-4 text-orange-600" />;
      default:
        return <History className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case "ENTRY":
        return "Ingreso de Activo";
      case "TRANSFER":
        return "Traslado";
      case "DECOMMISSION":
        return "Baja de Activo";
      case "REACTIVATION":
        return "Reactivación";
      default:
        return type;
    }
  };

  const getFileUrl = (path: string) => {
    // If it's already a full URL, return it
    if (path.startsWith("http")) return path;

    // Otherwise construct public URL from Supabase storage
    const { data } = supabase.storage
      .from("asset-authorizations")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 p-2 rounded-lg">
              <History className="w-5 h-5 text-sena-green" />
            </div>
            <div>
              <h3 className="font-bold text-base">Trazabilidad del Activo</h3>
              <p className="text-xs text-gray-400 font-mono tracking-wider">
                S/N: {serialNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sena-green mb-3"></div>
              <p className="text-sm">Cargando historial...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <History className="w-8 h-8 text-gray-300" />
              </div>
              <h4 className="text-gray-900 font-medium mb-1">
                Sin registros de trazabilidad
              </h4>
              <p className="text-sm text-gray-500">
                Este activo no tiene movimientos registrados en el nuevo
                sistema.
              </p>
            </div>
          ) : (
            <div className="relative pl-4 border-l-2 border-gray-200 space-y-8">
              {logs.map((log) => (
                <div key={log.id} className="relative">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[25px] top-0 bg-white border-2 border-gray-200 rounded-full p-1">
                    {getActionIcon(log.action_type)}
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-2 ${
                            log.action_type === "DECOMMISSION"
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : log.action_type === "ENTRY"
                                ? "bg-green-50 text-green-700 border border-green-100"
                                : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}
                        >
                          {getActionLabel(log.action_type)}
                        </span>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Realizado por:{" "}
                          <span className="font-medium text-gray-600">
                            {log.performed_by_user?.full_name || "Sistema"}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">
                        {formatDate(log.created_at)}
                      </span>
                    </div>

                    {/* Movement Details */}
                    {(log.previous_user || log.new_user) && (
                      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 mb-0.5">Origen</p>
                          <p className="font-medium truncate">
                            {log.previous_user?.full_name || "N/A"}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                        <div className="flex-1 text-right">
                          <p className="text-xs text-gray-400 mb-0.5">
                            Destino
                          </p>
                          <p className="font-medium truncate">
                            {log.new_user?.full_name || "N/A"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Comments */}
                    {log.comments && (
                      <p className="text-sm text-gray-600 mb-4 italic border-l-2 border-gray-200 pl-3">
                        &quot;{log.comments}&quot;
                      </p>
                    )}

                    {/* File Link */}
                    {log.authorization_file_url && (
                      <a
                        href={getFileUrl(log.authorization_file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-medium text-sena-green hover:text-green-700 hover:underline transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Ver Soporte de Autorización
                        <Download className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
