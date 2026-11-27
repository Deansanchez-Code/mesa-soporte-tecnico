"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Asset, ConfigItem, User } from "@/app/admin/admin.types";
import { NativeDialog } from "@/components/ui/NativeDialog";
import {
  Activity,
  ArrowRight,
  FileSpreadsheet,
  Monitor,
  Plus,
  Search,
  ShieldAlert,
} from "lucide-react";

interface AdminAssetsTabProps {
  assets: Asset[];
  usersList: User[];
  areas: ConfigItem[];
  currentUser: User | null;
  loading: boolean;
  onRefresh: () => void;
  onSelectAssetSerial: (serial: string) => void;
  onOpenTimeline: (asset: Asset) => void;
  onOpenAction: (asset: Asset, action: "TRANSFER" | "DECOMMISSION") => void;
}

export default function AdminAssetsTab({
  assets,
  usersList,
  areas,
  currentUser,
  loading,
  onRefresh,
  onSelectAssetSerial,
  onOpenTimeline,
  onOpenAction,
}: AdminAssetsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    serial: "",
    type: "Portátil",
    brand: "",
    model: "",
    userId: "",
    location: "",
  });

  const handleCreateAsset = async () => {
    if (!newAsset.serial || !newAsset.userId)
      return alert("Serial y Asignado A son obligatorios");
    try {
      const { error } = await supabase.from("assets").insert({
        serial_number: newAsset.serial,
        type: newAsset.type,
        brand: newAsset.brand,
        model: newAsset.model,
        assigned_to_user_id: newAsset.userId,
        location: newAsset.location || "Sin ubicación",
      });
      if (error) throw error;

      await supabase.from("asset_events").insert({
        asset_serial: newAsset.serial,
        event_type: "CREATED",
        description: "Equipo creado manualmente en inventario",
        actor_id: currentUser?.id,
      });

      alert("✅ Equipo registrado en inventario");
      setShowAssetModal(false);
      setNewAsset({
        serial: "",
        type: "Portátil",
        brand: "",
        model: "",
        userId: "",
        location: "",
      });
      onRefresh();
    } catch (error: unknown) {
      console.error("Error creating asset:", error);
      const sbError = error as {
        code?: string;
        status?: number;
        message?: string;
      };

      if (sbError.code === "42501" || sbError.status === 403) {
        alert(
          "⛔ Error de permisos: No tienes autorización para crear equipos.",
        );
      } else if (sbError.code === "23505") {
        alert("⚠️ Error: El serial ya existe en la base de datos.");
      } else {
        alert(`❌ Error desconocido: ${sbError.message || "Intenta de nuevo"}`);
      }
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "Serial,Tipo,Marca,Modelo,Ubicacion";
    const blob = new Blob(
      [`\uFEFF${headers}\nEJ123,Portátil,HP,ProBook,Sede Central`],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_carga_activos.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").slice(1);

      let successCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        const cols = row.split(",");
        if (cols.length < 5) continue;

        const [serial, type, brand, model, location] = cols.map((c) =>
          c.trim(),
        );
        if (!serial) continue;

        const { error } = await supabase.from("assets").insert({
          serial_number: serial,
          type: type || "Generico",
          brand: brand || "Generico",
          model: model || "Generico",
          location: location || "Sin ubicación",
          assigned_to_user_id: null,
        });

        if (error) errorCount++;
        else {
          successCount++;
          supabase.from("asset_events").insert({
            asset_serial: serial,
            event_type: "CREATED",
            description: "Carga masiva desde CSV",
            actor_id: currentUser?.id,
          });
        }
      }

      alert(
        `Carga finalizada:\n✅ ${successCount} creados\n❌ ${errorCount} fallidos (posibles duplicados)`,
      );
      onRefresh();
    };
    reader.readAsText(file);
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-gray-800">
          Inventario de Equipos
        </h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="text-xs text-sena-blue underline hover:text-blue-800"
            >
              Descargar Plantilla
            </button>
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" /> Importar CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleBulkUpload}
              />
            </label>
          </div>

          {currentUser?.role !== "admin" && (
            <button
              onClick={() => setShowAssetModal(true)}
              className="bg-sena-blue hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Nuevo Equipo
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por serial, modelo, marca o asignado..."
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
                Asignado A
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Tipo
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Serial
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                Ubicación
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets
              .filter(
                (a) =>
                  a.serial_number
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                  (a.model || "")
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                  (a.users?.full_name || "")
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()),
              )
              .map((asset) => (
                <tr
                  key={asset.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onSelectAssetSerial(asset.serial_number)}
                >
                  <td className="p-4 text-sm">
                    {asset.users ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                        {asset.users.full_name}
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs">
                        Sin asignar
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-800">{asset.type}</td>
                  <td className="p-4 font-mono text-xs font-bold text-gray-600">
                    {asset.serial_number}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {asset.location || "Sin ubicación"}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTimeline(asset);
                      }}
                      className="p-1.5 text-gray-400 hover:text-sena-blue hover:bg-blue-50 rounded transition"
                      title="Ver Trazabilidad"
                    >
                      <Activity className="w-4 h-4" />
                    </button>

                    {currentUser?.role !== "admin" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAction(asset, "TRANSFER");
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Trasladar Activo"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>

                        {asset.users?.full_name !== "Equipos de Baja" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAction(asset, "DECOMMISSION");
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Dar de Baja"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            {assets.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No hay equipos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NativeDialog
        isOpen={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        title="Nuevo Equipo"
        subtitle="Registro de Inventario Tecnológico"
        badgeText="GOV·SENA·ASSETS"
        headerIcon={<Monitor className="w-5 h-5 text-emerald-300" />}
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="swiss-section-tag block mb-2">
              01 / DATOS DEL EQUIPO
            </label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <select
                className="border border-slate-300 p-3 rounded-lg w-full text-sm bg-white"
                value={newAsset.type}
                onChange={(e) =>
                  setNewAsset({ ...newAsset, type: e.target.value })
                }
              >
                <option>Portátil</option>
                <option>Escritorio</option>
                <option>Monitor</option>
                <option>Periférico</option>
              </select>
              <input
                type="text"
                className="border border-slate-300 p-3 rounded-lg w-full text-sm"
                placeholder="Marca (HP, Dell)"
                value={newAsset.brand}
                onChange={(e) =>
                  setNewAsset({ ...newAsset, brand: e.target.value })
                }
              />
            </div>
            <input
              type="text"
              className="border border-slate-300 p-3 rounded-lg w-full mt-3 text-sm"
              placeholder="Modelo (Ej: ProBook 450 G9)"
              value={newAsset.model}
              onChange={(e) =>
                setNewAsset({ ...newAsset, model: e.target.value })
              }
            />
            <input
              type="text"
              className="border border-slate-300 p-3 rounded-lg w-full mt-3 tabular-mono text-sm"
              placeholder="SERIAL (S/N)"
              value={newAsset.serial}
              onChange={(e) =>
                setNewAsset({ ...newAsset, serial: e.target.value })
              }
            />
            <input
              type="text"
              className="border border-slate-300 p-3 rounded-lg w-full mt-3 text-sm"
              placeholder="Ubicación (Ej: Sede Central)"
              value={newAsset.location}
              onChange={(e) =>
                setNewAsset({ ...newAsset, location: e.target.value })
              }
              list="locations-list"
            />
            <datalist id="locations-list">
              {Array.from(
                new Set([
                  ...assets
                    .map((a) => a.location)
                    .filter((l) => l && l !== "Sin ubicación"),
                  ...areas.map((area) => area.name),
                ]),
              )
                .sort()
                .map((loc, index) => (
                  <option key={index} value={loc || ""} />
                ))}
            </datalist>
          </div>

          <div>
            <label className="swiss-section-tag block mb-1.5">
              02 / ASIGNAR CUSTODIO
            </label>
            <select
              className="border border-slate-300 p-3 rounded-lg w-full text-sm bg-white"
              value={newAsset.userId}
              onChange={(e) =>
                setNewAsset({ ...newAsset, userId: e.target.value })
              }
            >
              <option value="">-- Seleccionar Funcionario --</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAssetModal(false)}
              className="flex-1 min-h-[44px] py-2.5 text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateAsset}
              className="flex-1 min-h-[44px] py-2.5 bg-sena-green hover:bg-[#2d8500] active:translate-y-[1px] text-white font-bold rounded-lg transition"
            >
              Registrar Equipo
            </button>
          </div>
        </div>
      </NativeDialog>
    </section>
  );
}
