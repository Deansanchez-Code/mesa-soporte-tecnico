"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/cliente";
import {
  Upload,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  X,
  Loader2,
  User,
} from "lucide-react";

interface AssetActionModalProps {
  asset: {
    id: number;
    serial_number: string;
    model: string;
    assigned_to_user_id: string;
  };
  action: "TRANSFER" | "DECOMMISSION";
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}

export default function AssetActionModal({
  asset,
  action,
  onClose,
  onSuccess,
  currentUserId,
}: AssetActionModalProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  // Cargar usuarios para el selector (solo si es traslado)
  useEffect(() => {
    if (action === "TRANSFER") {
      const fetchUsers = async () => {
        const { data } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
          .neq("id", asset.assigned_to_user_id) // Excluir dueño actual
          .order("full_name");
        if (data) setUsers(data);
      };
      fetchUsers();
    }
  }, [action, asset.assigned_to_user_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Debes adjuntar el soporte de autorización.");
    if (action === "TRANSFER" && !targetUserId)
      return alert("Debes seleccionar el nuevo responsable.");

    setLoading(true);

    try {
      // 1. Subir archivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${asset.serial_number}_${Date.now()}.${fileExt}`;
      const filePath = `${action.toLowerCase()}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("asset-authorizations")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Determinar nuevo usuario
      // Si es BAJA, usamos el ID fijo del usuario "Equipos de Baja"
      // ID Fijo: 00000000-0000-0000-0000-000000000000
      const newOwnerId =
        action === "DECOMMISSION"
          ? "00000000-0000-0000-0000-000000000000"
          : targetUserId;

      // 3. Registrar Log
      const { error: logError } = await supabase.from("asset_logs").insert({
        asset_id: asset.id,
        action_type: action,
        previous_user_id: asset.assigned_to_user_id,
        new_user_id: newOwnerId,
        performed_by_user_id: currentUserId,
        authorization_file_url: filePath,
        comments: comments,
      });

      if (logError) throw logError;

      // 4. Actualizar Activo
      const { error: updateError } = await supabase
        .from("assets")
        .update({ assigned_to_user_id: newOwnerId })
        .eq("id", asset.id);

      if (updateError) throw updateError;

      alert("✅ Acción realizada correctamente.");
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div
          className={`p-4 text-white flex justify-between items-center ${
            action === "DECOMMISSION" ? "bg-red-600" : "bg-blue-600"
          }`}
        >
          <div className="flex items-center gap-2">
            {action === "DECOMMISSION" ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
            <h3 className="font-bold">
              {action === "DECOMMISSION"
                ? "Dar de Baja Activo"
                : "Trasladar Activo"}
            </h3>
          </div>
          <button onClick={onClose} className="hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
            <p className="text-gray-500 text-xs uppercase font-bold mb-1">
              Activo Seleccionado
            </p>
            <p className="font-bold text-gray-800">
              {asset.model}{" "}
              <span className="font-normal">({asset.serial_number})</span>
            </p>
          </div>

          {action === "TRANSFER" && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Nuevo Responsable
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full pl-9 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                  required
                >
                  <option value="">Seleccione un usuario...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {action === "DECOMMISSION" && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">
                El activo será asignado al usuario{" "}
                <strong>&quot;Equipos de Baja&quot;</strong>. Esta acción
                requiere autorización firmada.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Soporte de Autorización (PDF/Imagen)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              {file ? (
                <p className="text-sm text-sena-green font-bold truncate">
                  {file.name}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Clic para subir archivo obligatorio
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none text-sm"
              rows={3}
              placeholder="Detalles adicionales del movimiento..."
            ></textarea>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2.5 text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-2 transition ${
                action === "DECOMMISSION"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              } ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                </>
              ) : (
                "Confirmar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
