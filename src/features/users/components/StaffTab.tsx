"use client";

import { useState } from "react";
import {
  UserPlus,
  FileSpreadsheet,
  Search,
  Edit,
  Trash2,
  Power,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Copy,
  Loader2,
} from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import { supabase } from "@/lib/supabase/client";
import { User, ConfigItem } from "@/app/admin/admin.types";
import { useUserManagement } from "../hooks/useUserManagement";
import UserModal from "./UserModal";
import { NativeDialog } from "@/components/ui/NativeDialog";
import { toast } from "sonner";
import { formatName } from "@/lib/utils";

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
    handleToggleUserActive,
    handleToggleCoordinator,
    resetUserForm,
  } = useUserManagement(onRefresh);

  const [searchTerm, setSearchTerm] = useState("");
  const [pinTargetUser, setPinTargetUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  const generateSixDigitPin = () => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const num = 100000 + (arr[0] % 900000);
    setPinInput(String(num));
  };

  const handleSaveVipPin = async () => {
    if (!pinTargetUser) return;
    if (!/^\d{6}$/.test(pinInput)) {
      toast.error("El PIN debe contener exactamente 6 dígitos numéricos.");
      return;
    }

    setIsSavingPin(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sesión administrativa expirada. Inicia sesión de nuevo.");
        return;
      }

      const res = await fetch("/api/admin/users/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: pinTargetUser.id,
          pin: pinInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "No se pudo guardar el PIN.");
        return;
      }

      toast.success(
        `PIN de 6 dígitos asignado a ${formatName(pinTargetUser.full_name)}.`,
        {
          description:
            "Comunícale el código de forma directa tras validar su identidad.",
        },
      );
      setPinTargetUser(null);
      setPinInput("");
      onRefresh();
    } catch {
      toast.error("Error de conexión al asignar el PIN.");
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleBulkStaffUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Formato inválido", {
        description: "Solo se admiten archivos .xlsx.",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Archivo demasiado grande", {
        description: "El archivo Excel no debe superar 5MB.",
      });
      return;
    }

    try {
      const rows = await readSheet(file);
      if (rows.length < 2) {
        toast.warning("Archivo vacío", {
          description: "El Excel no contiene filas de funcionarios.",
        });
        return;
      }

      const headers = rows[0].map((cell) =>
        String(cell ?? "")
          .trim()
          .toLowerCase(),
      );
      const colIdx = {
        fullName: headers.findIndex((h) => h.includes("nombre")),
        username: headers.findIndex((h) => h.includes("usuario")),
        location: headers.findIndex(
          (h) => h.includes("ubicaci") || h.includes("area"),
        ),
        vip: headers.findIndex((h) => h === "vip"),
      };

      if (
        colIdx.fullName === -1 ||
        colIdx.username === -1 ||
        colIdx.location === -1
      ) {
        toast.error("Columnas faltantes", {
          description:
            "El archivo debe incluir columnas: Nombre Completo, Usuario, Ubicación y VIP.",
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of rows.slice(1)) {
        const fullName = String(row[colIdx.fullName] ?? "").trim();
        const username = String(row[colIdx.username] ?? "").trim();
        const location = String(row[colIdx.location] ?? "").trim();
        const isVip =
          colIdx.vip !== -1 &&
          String(row[colIdx.vip] ?? "")
            .trim()
            .toUpperCase() === "SI";

        if (!fullName || !username || !location) {
          errorCount++;
          continue;
        }

        const { error } = await supabase.from("users").insert({
          full_name: fullName,
          username: username.toLowerCase(),
          role: "user",
          area: location,
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

      toast.success("Carga Finalizada", {
        description: `Exitosos: ${successCount} | Fallidos: ${errorCount}`,
      });
      onRefresh();
    } catch (error) {
      console.error("Error procesando archivo:", error);
      toast.error("Error de Archivo", {
        description: "No se pudo procesar el archivo Excel (.xlsx).",
      });
    }
  };

  const handleDownloadStaffTemplate = async () => {
    await writeXlsxFile(
      [
        [
          { value: "Nombre Completo", fontWeight: "bold" },
          { value: "Usuario", fontWeight: "bold" },
          { value: "Ubicación", fontWeight: "bold" },
          { value: "VIP", fontWeight: "bold" },
        ],
        [
          { value: "Juan Perez", type: String },
          { value: "jperez", type: String },
          { value: "Coordinación Académica", type: String },
          { value: "NO", type: String },
        ],
      ],
      { sheet: "Plantilla" },
    ).toFile("plantilla_funcionarios.xlsx");
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
                  accept=".xlsx"
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
                <th className="px-6 py-3 font-semibold text-gray-600">
                  Cargo / Privilegios
                </th>
                <th className="px-6 py-3 font-semibold text-gray-600">
                  Estado
                </th>
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
                  <tr
                    key={user.id}
                    className={`hover:bg-gray-50 ${
                      user.is_active === false ? "bg-red-50/40 opacity-75" : ""
                    }`}
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {formatName(user.full_name)}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{user.username}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {user.area || "N/A"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(user.job_category?.toLowerCase() === "coordinador" ||
                          user.perm_manage_assignments) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Coordinador(a)
                          </span>
                        )}
                        {user.is_vip ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                            VIP
                          </span>
                        ) : (
                          user.job_category?.toLowerCase() !== "coordinador" &&
                          !user.perm_manage_assignments && (
                            <span className="text-gray-400 text-xs">
                              Planta
                            </span>
                          )
                        )}
                        {(user.is_vip ||
                          user.job_category?.toLowerCase() === "coordinador" ||
                          user.perm_manage_assignments) &&
                          (user.has_kiosk_pin ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              PIN Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Sin PIN
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {user.is_active !== false ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    {currentUserRole !== "admin" && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPinTargetUser(user);
                              generateSixDigitPin();
                            }}
                            aria-label={`Asignar o rotar PIN VIP para ${user.full_name}`}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition active:translate-y-[1px] ${
                              user.has_kiosk_pin
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                : "bg-white border-slate-200 text-amber-600 hover:bg-amber-50 hover:border-amber-200"
                            }`}
                            title="Asignar / Rotar PIN numérico (6 dígitos) para acceso VIP"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCoordinator(user)}
                            aria-label={`Alternar rol Coordinador para ${user.full_name}`}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition active:translate-y-[1px] ${
                              user.job_category?.toLowerCase() === "coordinador"
                                ? "bg-purple-100 border-purple-200 text-purple-700 hover:bg-purple-200"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-purple-50 hover:text-purple-600"
                            }`}
                            title={
                              user.job_category?.toLowerCase() === "coordinador"
                                ? "Es Coordinador(a) con privilegios VIP (Clic para quitar)"
                                : "Designar como Coordinador(a) (Otorga VIP y funciones amplias)"
                            }
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(user)}
                            aria-label={
                              user.is_active !== false
                                ? `Desactivar cuenta de ${user.full_name}`
                                : `Habilitar cuenta de ${user.full_name}`
                            }
                            className={`w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center transition active:translate-y-[1px] ${
                              user.is_active !== false
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={
                              user.is_active !== false
                                ? "Desactivar acceso (conserva historial)"
                                : "Habilitar acceso (restaurar cuenta)"
                            }
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditUser(user)}
                            aria-label={`Editar usuario ${user.full_name}`}
                            className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 flex items-center justify-center text-blue-600 transition active:translate-y-[1px]"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id)}
                            aria-label={`Eliminar usuario ${user.full_name}`}
                            className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-red-50 flex items-center justify-center text-red-600 transition active:translate-y-[1px]"
                            title="Eliminar permanentemente/Baja"
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

      <NativeDialog
        isOpen={Boolean(pinTargetUser)}
        onClose={() => {
          setPinTargetUser(null);
          setPinInput("");
        }}
        title="Asignar PIN de Acceso VIP"
        subtitle={
          pinTargetUser
            ? `${formatName(pinTargetUser.full_name)} (@${pinTargetUser.username})`
            : ""
        }
        badgeText="GOV·SENA·PIN"
        headerIcon={<KeyRound className="w-5 h-5 text-emerald-300" />}
        maxWidthClass="max-w-md"
      >
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
            El PIN se almacena cifrado (
            <code className="tabular-mono">scrypt</code>) y nunca se muestra de
            nuevo después de guardarlo. Valida la identidad del funcionario VIP
            o coordinador antes de entregarle este código.
          </div>

          <div className="space-y-1.5">
            <label className="swiss-section-tag block">
              01 / PIN NUMÉRICO DE 6 DÍGITOS
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-center tabular-mono text-2xl font-bold tracking-[0.35em] focus:ring-2 focus:ring-sena-green outline-none bg-[#F8FAFC]"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={generateSixDigitPin}
                aria-label="Generar nuevo PIN aleatorio"
                className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition active:translate-y-[1px]"
                title="Generar nuevo PIN aleatorio"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!pinInput) return;
                  navigator.clipboard
                    .writeText(pinInput)
                    .then(() => toast.info("PIN copiado al portapapeles."))
                    .catch(() => {});
                }}
                aria-label="Copiar PIN al portapapeles"
                className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition active:translate-y-[1px]"
                title="Copiar PIN"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSavingPin}
            onClick={() => {
              setPinTargetUser(null);
              setPinInput("");
            }}
            className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSavingPin || pinInput.length !== 6}
            onClick={handleSaveVipPin}
            className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-sena-green hover:bg-emerald-700 active:translate-y-[1px] rounded-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingPin ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar PIN"
            )}
          </button>
        </div>
      </NativeDialog>
    </div>
  );
}
