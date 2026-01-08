"use client";

import { useState } from "react";
import { UserPlus, FileSpreadsheet, Search, Edit, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase/cliente";
import { User, ConfigItem, StaffUploadRow } from "@/app/admin/admin.types";
import { useUserManagement } from "../hooks/useUserManagement";
import UserModal from "./UserModal";

interface StaffTabProps {
  usersList: User[];
  onRefresh: () => void;
  configData: {
    areas: ConfigItem[];
  };
  currentUserRole?: string;
}

export default function StaffTab({
  usersList,
  onRefresh,
  configData,
  currentUserRole,
}: StaffTabProps) {
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

  const handleBulkStaffUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;
        let errorCount = 0;

        for (const row of data as StaffUploadRow[]) {
          // Mapeo de columnas
          const fullName = row["Nombre Completo"];
          const username = row["Usuario"];
          const location = row["Ubicación"];
          const isVip = row["VIP"]?.toString().toUpperCase() === "SI";

          if (!fullName || !username || !location) {
            errorCount++;
            continue;
          }

          const { error } = await supabase.from("users").insert({
            full_name: fullName,
            username: username.toLowerCase(),
            role: "user",
            area: location,
            password: "Sena2024*",
            is_vip: isVip,
            is_active: true,
            perm_create_assets: false,
            perm_transfer_assets: false,
            perm_decommission_assets: false,
          });

          if (error) {
            console.error("Error importando usuario:", username, error);
            errorCount++;
          } else {
            successCount++;
          }
        }

        alert(
          `Carga finalizada.\n✅ Exitosos: ${successCount}\n❌ Fallidos: ${errorCount}`,
        );
        onRefresh();
      } catch (error) {
        console.error("Error procesando archivo:", error);
        alert("Error al procesar el archivo Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadStaffTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Nombre Completo": "Juan Perez",
        Usuario: "jperez",
        Ubicación: "Coordinación Académica",
        VIP: "NO",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_funcionarios.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        {currentUserRole !== "admin" && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetUserForm();
                setNewAgent({ ...newAgent, role: "user" });
                setShowAgentModal(true);
              }}
              className="flex items-center gap-2 bg-sena-green text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm font-bold"
            >
              <UserPlus className="w-4 h-4" /> Nuevo Funcionario
            </button>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer font-medium">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                Carga Masiva
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleBulkStaffUpload}
                />
              </label>
              <button
                onClick={handleDownloadStaffTemplate}
                className="text-xs text-blue-600 hover:underline"
              >
                Descargar Plantilla
              </button>
            </div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar funcionario..."
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-green focus:border-transparent w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-gray-600">
                  Nombre
                </th>
                <th className="px-6 py-3 font-semibold text-gray-600">
                  Usuario
                </th>
                <th className="px-6 py-3 font-semibold text-gray-600">
                  Ubicación
                </th>
                <th className="px-6 py-3 font-semibold text-gray-600">VIP</th>
                {currentUserRole !== "admin" && (
                  <th className="px-6 py-3 font-semibold text-gray-600 text-right">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usersList
                .filter((u) => {
                  return (
                    u.role === "user" &&
                    u.employment_type?.toLowerCase() !== "contratista" && // Exclude contractors
                    (u.full_name
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                      u.username
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()))
                  );
                })
                .map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{user.username}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {user.area || "N/A"}
                    </td>
                    <td className="px-6 py-3">
                      {user.is_vip ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          VIP
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {currentUserRole !== "admin" && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-1 hover:bg-gray-100 rounded text-blue-600 transition"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1 hover:bg-gray-100 rounded text-red-600 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        onSave={handleCreateOrUpdateUser}
        newAgent={newAgent}
        setNewAgent={setNewAgent}
        areas={configData.areas}
      />
    </div>
  );
}
