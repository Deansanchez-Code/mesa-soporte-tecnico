"use client";

import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState, useMemo } from "react";
import { lazy } from "react";
import { supabase } from "@/lib/supabase";
import { safeRemoveItem } from "@/lib/storage";
import {
  Shield,
  Users,
  Activity,
  Trash2,
  Monitor,
  Plus,
  Laptop,
  Download,
  PieChart as PieChartIcon,
  QrCode,
  LogOut,
  Settings,
  FileSpreadsheet,
  Search,
  MapPin,
  LayoutDashboard,
  FileText,
  ArrowRight, // Restaurado
  ShieldAlert,
  Loader2,
  Clock, // Nuevo para Turnos
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRGenerator from "@/components/admin/QRGenerator";
import AgentsTab from "@/components/admin/AgentsTab";
import StaffTab from "@/components/admin/StaffTab";
import ContractorsTab from "@/components/admin/ContractorsTab";
const MetricsTab = lazy(() => import("@/components/admin/MetricsTab"));
const ShiftsTab = lazy(() => import("@/components/admin/ShiftsTab"));
import {
  Agent,
  User,
  ConfigItem,
  Asset,
  Ticket,
  Stats,
} from "@/app/admin/types";
import AuditTab from "@/components/admin/AuditTab";
import React from "react";
import { TicketsTableSkeleton } from "@/components/ui/skeletons/TicketsTableSkeleton";
import DraggableDashboard from "@/components/admin/dashboard/DraggableDashboard";
import AssetHistoryTimeline from "@/components/features/assets/AssetHistoryTimeline";

const AssetHistoryModal = React.lazy(
  () => import("@/components/features/assets/AssetHistoryModal"),
);
const AssetActionModal = React.lazy(
  () => import("@/components/features/assets/AssetActionModal"),
);
const TicketDetailsModal = React.lazy(
  () => import("@/components/features/tickets/TicketDetailsModal"),
);
const UserProfileModal = React.lazy(
  () => import("@/components/shared/UserProfileModal"),
);
import { useTicketsQuery } from "@/components/features/tickets/hooks/useTicketsQuery";
import PaginationControls from "@/components/ui/PaginationControls";

// --- TIPOS DE DATOS ---

import { useUserProfile } from "@/hooks/useUserProfile";

export default function AdminDashboard() {
  const router = useRouter();
  const { user: sbUser, profile } = useUserProfile();

  const currentUser = useMemo(() => {
    if (!sbUser) return null;
    const mappedUser = {
      ...sbUser, // Supabase user props
      id: sbUser.id,
      full_name:
        profile?.full_name || sbUser.user_metadata?.full_name || "Usuario",
      username: profile?.username || sbUser.email?.split("@")[0] || "user",
      role: profile?.role || "agent",
      email: sbUser.email,
      // Default required fields for local User type
      is_vip: profile?.is_vip || false,
      is_active: profile?.is_active ?? true,
      area: profile?.area || "General",
    };
    return mappedUser as unknown as User;
  }, [sbUser, profile]);

  // Estados Generales
  const [activeTab, setActiveTab] = useState<
    | "agents"
    | "assets"
    | "metrics"
    | "qr"
    | "settings"
    | "tickets"
    | "staff"
    | "contractors"
    | "audit"
    | "shifts"
  >("agents");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Buscador general
  const [selectedAssetSerial, setSelectedAssetSerial] = useState<string | null>(
    null,
  ); // Modal historial
  const [currentAdminName, setCurrentAdminName] = useState("Super Admin");
  const [ticketFilter, setTicketFilter] = useState<"ALL" | "PENDING">("ALL"); // Filtro para la pestaña de tickets

  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    pendingTickets: 0,
    totalAssets: 0,
  });

  // Estados Datos
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  // const [tickets, setTickets] = useState<Ticket[]>([]); // Replaced by useQuery
  const [usersList, setUsersList] = useState<User[]>([]);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: ticketsData, isLoading: isLoadingTickets } = useTicketsQuery({
    page,
    pageSize,
    status: ticketFilter,
  });

  const tickets = ticketsData?.data || [];
  const totalTicketsCount = ticketsData?.count || 0;

  // Estado para Configuración
  const [configData, setConfigData] = useState<{
    areas: ConfigItem[];
    categories: ConfigItem[];
  }>({ areas: [], categories: [] });
  const [newConfigItem, setNewConfigItem] = useState("");

  // Estados Modales
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); // Estado para modal de perfil

  // Estados para Acciones de Activos
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAssetForAction, setSelectedAssetForAction] =
    useState<Asset | null>(null);
  const [actionType, setActionType] = useState<"TRANSFER" | "DECOMMISSION">(
    "TRANSFER",
  );

  const [newAsset, setNewAsset] = useState({
    serial: "",
    type: "Portátil",
    brand: "",
    model: "",
    userId: "",
    location: "",
  });

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Función para asignar ticket
  const handleAssignTicket = async (ticketId: number, agentId: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_agent_id: agentId, status: "EN_PROGRESO" }) // Automatically set to In Progress if assigned? Or Keep Pending? User didn't specify. Assuming assignment starts progress or just assigns. Let's keep status update optional or safe.
      .eq("id", ticketId);

    if (error) {
      console.error(error);
      alert("Error al asignar el ticket");
      throw error;
    }

    alert("Agente asignado correctamente.");
    fetchData(); // Refresh list
  };

  // Función para agregar comentario/trazabilidad
  const handleAddComment = async (ticketId: number, comment: string) => {
    if (!selectedTicket || !currentUser) return;

    const timestamp = new Date().toLocaleString();
    const actor = currentUser.full_name || "Usuario";
    const auditLog = `\n\n[${timestamp}] SEGUIMIENTO: ${comment} (Por: ${actor})`;

    const newDescription = (selectedTicket.description || "") + auditLog;

    const { error } = await supabase
      .from("tickets")
      .update({
        description: newDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (error) {
      console.error(error);
      alert("Error guardando comentario.");
      throw error;
    }

    // Actualizar estado local para ver cambios inmediatamente
    setSelectedTicket({ ...selectedTicket, description: newDescription });
    fetchData(); // Refresh list (background)
  };

  // Función para actualizar estado con trazabilidad
  const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
    if (!selectedTicket || !currentUser) return;

    const timestamp = new Date().toLocaleString();
    const actor = currentUser.full_name || "Usuario";
    const auditLog = `\n\n[${timestamp}] SEGUIMIENTO: Cambio de estado a ${newStatus} (Por: ${actor})`;

    const newDescription = (selectedTicket.description || "") + auditLog;

    const { error } = await supabase
      .from("tickets")
      .update({
        status: newStatus,
        description: newDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (error) {
      console.error(error);
      alert("Error actualizando estado.");
      throw error;
    }

    // Actualizar estado local
    setSelectedTicket({
      ...selectedTicket,
      status: newStatus,
      description: newDescription,
    });
    fetchData();
  };

  // --- 1. CARGA INICIAL DE DATOS ---
  const fetchData = React.useCallback(async () => {
    setLoading(true);

    if (currentUser) {
      setCurrentAdminName(currentUser.full_name || "Super Admin");
    }

    // A. Cargar Todo en Paralelo
    const [
      /* 0 */ { data: apiUsers },
      /* 1 */ { data: sbAssets },
      /* 2 */ { data: sbAreas },
      /* 3 */ { data: sbCats },
    ] = await Promise.all([
      // 1. Usuarios API
      (async () => {
        try {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          // If no session (admin/page might be protected but token can be stale), handle gracefully
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;

          const res = await fetch("/api/admin/users?limit=2000", { headers });
          if (!res.ok) {
            console.warn("API User fetch failed, trying local DB fallback");
            return { data: [] };
          }
          const json = await res.json();
          return { data: json.users };
        } catch (e) {
          console.error("User fetch error:", e);
          return { data: [] };
        }
      })(),
      // 2. Activos
      supabase
        .from("assets")
        .select(
          "id, serial_number, type, brand, model, assigned_to_user_id, location, created_at, users(full_name)",
        )
        .order("created_at", { ascending: false }),
      // 3. Áreas
      supabase.from("areas").select("id, name").order("name"),
      // 4. Categorías
      supabase.from("categories").select("id, name").order("name"),
    ]);

    // B. Mapeo Correcto de Datos
    const fetchedUsers = (apiUsers as unknown as User[]) || [];
    const fetchedAssets = (sbAssets as unknown as Asset[]) || [];
    const fetchedAreas = (sbAreas as unknown as ConfigItem[]) || [];
    const fetchedCats = (sbCats as unknown as ConfigItem[]) || [];

    // --- LOGS DE DEPURACIÓN ---
    console.log("Users:", fetchedUsers.length);
    console.log("Areas:", fetchedAreas);
    console.log("Cats:", fetchedCats);

    setConfigData({
      areas: fetchedAreas,
      categories: fetchedCats,
    });

    // B. Setear Estados
    const allFetchedUsers = fetchedUsers;

    // Filter Agents (Staff)
    const staffRoles = ["agent", "admin", "superadmin"];
    const staffUsers = allFetchedUsers.filter((u) =>
      staffRoles.includes(u.role),
    );
    setAgents(
      staffUsers.sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || ""),
      ),
    );

    // All Users List
    setUsersList(
      allFetchedUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)),
    );

    if (fetchedAssets.length > 0) setAssets(fetchedAssets);

    // Config Data already set above using fetchedAreas/fetchedCats

    setStats({
      totalTickets: totalTicketsCount,
      pendingTickets: 0, // Pending count was removed from query, setting 0 or relying on tickets query result if needed.
      totalAssets: fetchedAssets.length || 0,
    });

    setLoading(false);
  }, [currentUser, totalTicketsCount]);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser, fetchData]);

  // --- 2. LOGICA AGENTES / USUARIOS ---

  // --- CARGUE MASIVO DE FUNCIONARIOS ---

  const handleLogout = async () => {
    await supabase.auth.signOut();
    safeRemoveItem("tic_user");
    router.push("/login");
  };

  // --- 3. LOGICA ACTIVOS ---
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

      // TRAZABILIDAD: LOG EVENT
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
      fetchData();
    } catch (error: unknown) {
      console.error("Error creating asset:", error);
      // Validar si es error de Supabase/postgres
      const sbError = error as {
        code?: string;
        status?: number;
        message?: string;
      }; // simple casting

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

  // --- 3.1 CARGA MASIVA DE ACTIVOS ---
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
      const rows = text.split("\n").slice(1); // Ignorar header

      let successCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        const cols = row.split(",");
        if (cols.length < 5) continue; // Mínimo serial, tipo, marca, modelo, ubicacion

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
          assigned_to_user_id: null, // Por defecto sin asignar
        });

        if (error) errorCount++;
        else {
          successCount++;
          // TRAZABILIDAD: LOG EVENT (Background, no await to speed up)
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
      fetchData();
    };
    reader.readAsText(file);
  };

  // --- 3.2 GESTIÓN DE CONFIGURACIÓN ---
  const handleAddConfig = async (type: "areas" | "categories") => {
    if (!newConfigItem) return;
    const { error } = await supabase
      .from(type)
      .insert({ name: newConfigItem.toUpperCase() });
    if (error) alert("Error: Posible duplicado");
    else {
      setNewConfigItem("");
      fetchData();
    }
  };

  const handleDeleteConfig = async (
    type: "areas" | "categories",
    id: number,
  ) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    await supabase.from(type).delete().eq("id", id);
    fetchData();
  };

  // --- 4. EXPORTAR CSV ---
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      // 1. Obtener datos completos
      const { data, error } = await supabase.from("tickets").select(`
          id,
          created_at,
          status,
          category,
          location,
          description,
          users ( full_name, area, username ),
          assets ( serial_number, model )
        `);

      if (error) throw error;
      if (!data || data.length === 0)
        return alert("No hay datos para exportar");

      // Definimos el tipo esperado de la respuesta de Supabase
      interface TicketExport {
        id: number;
        created_at: string;
        status: string;
        category: string;
        location: string;
        description: string;
        users: { full_name: string; area: string; username: string } | null;
        assets: { serial_number: string; model: string } | null;
      }

      const tickets = data as unknown as TicketExport[];

      // 2. Construir CSV
      const headers = [
        "ID Ticket",
        "Fecha Creación",
        "Estado",
        "Categoría",
        "Solicitante",
        "Usuario",
        "Área",
        "Ubicación",
        "Equipo (Serial)",
        "Equipo (Modelo)",
        "Descripción",
      ];

      const csvRows = [
        headers.join(","), // Encabezado
        ...tickets.map((t) => {
          // Verificamos si users/assets son arrays (por si acaso) o objetos
          const user = Array.isArray(t.users) ? t.users[0] : t.users;
          const asset = Array.isArray(t.assets) ? t.assets[0] : t.assets;

          const row = [
            t.id,
            new Date(t.created_at).toLocaleDateString("es-CO"),
            t.status,
            t.category,
            `"${user?.full_name || "N/A"}"`,
            user?.username || "N/A",
            user?.area || "N/A",
            `"${t.location || ""}"`,
            asset?.serial_number || "N/A",
            `"${asset?.model || "N/A"}"`,
            `"${(t.description || "").replace(/"/g, '""')}"`,
          ];
          return row.join(",");
        }),
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM para Excel

      // 3. Descargar
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `reporte_gestion_tic_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert("Error generando el reporte");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AuthGuard allowedRoles={["admin", "superadmin"]}>
      <div className="min-h-screen bg-gray-100 font-sans w-full relative overflow-x-hidden">
        {/* MODAL PERFIL */}
        {showProfileModal && currentUser && (
          <UserProfileModal
            user={currentUser}
            onClose={() => setShowProfileModal(false)}
          />
        )}

        {/* MODAL HISTORIAL DE ACTIVO */}
        {/* MODAL HISTORIAL DE ACTIVO (TICKETS) */}
        {selectedAssetSerial && (
          <AssetHistoryModal
            serialNumber={selectedAssetSerial}
            onClose={() => setSelectedAssetSerial(null)}
          />
        )}

        {/* MODAL TRAZABILIDAD (LOGS) */}
        {showTimelineModal && selectedAssetForAction && (
          <AssetHistoryTimeline
            assetId={selectedAssetForAction.id.toString()}
            serialNumber={selectedAssetForAction.serial_number}
            onClose={() => {
              setShowTimelineModal(false);
              setSelectedAssetForAction(null);
            }}
          />
        )}

        {/* MODAL ACCIONES (TRASLADO/BAJA) */}
        {showActionModal && selectedAssetForAction && currentUser && (
          <AssetActionModal
            asset={{
              id: selectedAssetForAction.id,
              serial_number: selectedAssetForAction.serial_number,
              model: selectedAssetForAction.model || "",
              assigned_to_user_id:
                selectedAssetForAction.assigned_to_user_id || "",
            }}
            action={actionType}
            currentUserId={currentUser.id}
            onClose={() => {
              setShowActionModal(false);
              setSelectedAssetForAction(null);
            }}
            onSuccess={() => {
              setShowActionModal(false);
              setSelectedAssetForAction(null);
              fetchData();
            }}
          />
        )}

        {/* NAVBAR */}
        <header className="bg-sena-blue text-white h-16 px-6 flex items-center justify-between shadow-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-sena-green" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">
                Panel de Control
              </h1>
              <p className="text-[10px] text-gray-300 tracking-wider uppercase">
                {currentAdminName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden md:flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white transition"
            >
              <LayoutDashboard className="w-4 h-4" /> Ir a Mesa de Ayuda
            </Link>

            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 bg-sena-green hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <span className="animate-pulse">Generando...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Exportar Reporte
                </>
              )}
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="h-10 w-10 rounded-full bg-sena-green flex items-center justify-center font-bold border-2 border-white cursor-pointer hover:bg-green-700 transition"
              title="Ver Perfil"
            >
              {currentUser?.full_name
                ? currentUser.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((n: string) => n[0])
                    .join("")
                : "AD"}
            </button>
            <button
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl mx-auto space-y-8 w-full overflow-x-hidden">
          {/* --- KPIs --- */}
          {/* --- KPI CARDS (DRAGGABLE) --- */}
          <DraggableDashboard
            stats={stats}
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            setTicketFilter={setTicketFilter}
          />

          {/* --- PESTAÑAS DE NAVEGACIÓN --- */}
          {/* --- PESTAÑAS DE NAVEGACIÓN (RESPONSIVE) --- */}
          {/* --- PESTAÑA NAVEGACIÓN ESTILO CARPETA (SENA) --- */}
          <div className="flex flex-wrap items-end gap-1 border-b-[3px] border-[#39A900] px-2 pt-4">
            {[
              { id: "agents", label: "Mesa", icon: Users },
              { id: "staff", label: "Funcionarios", icon: Users },
              { id: "contractors", label: "Contratistas", icon: Users },
              { id: "audit", label: "Auditoría", icon: ShieldAlert },
              { id: "shifts", label: "Turnos", icon: Clock },
              { id: "metrics", label: "Métricas", icon: PieChartIcon },
              ...(currentUser?.role !== "superadmin"
                ? [{ id: "tickets", label: "Tickets", icon: FileText }]
                : []),
              { id: "assets", label: "Inventario", icon: Laptop },
              { id: "qr", label: "QR", icon: QrCode },
              { id: "settings", label: "Config", icon: Settings },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    group relative flex-grow md:flex-grow-0 flex items-center justify-center gap-2 px-4 rounded-t-lg border-t-2 border-x-2 transition-all duration-200 ease-out whitespace-nowrap
                    ${
                      isActive
                        ? "bg-white text-[#39A900] py-3 -mb-[3px] z-10 font-extrabold border-[#39A900] border-b-white"
                        : "bg-gray-100 text-gray-500 py-2.5 mb-0 z-0 hover:bg-[#e6f4e3] hover:text-[#39A900] border-gray-200"
                    }
                  `}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? "text-[#39A900]"
                        : "text-gray-400 group-hover:text-[#39A900]"
                    }`}
                  />
                  <span className="text-sm">{tab.label}</span>

                  {/* Top Accent for Active */}
                  {isActive && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-[#39A900] rounded-t-sm" />
                  )}
                </button>
              );
            })}
          </div>

          {/* --- CONTENIDO PESTAÑA: MÉTRICAS --- */}
          {activeTab === "metrics" && <MetricsTab />}

          {/* --- CONTENIDO PESTAÑA: AGENTES / USUARIOS --- */}
          {activeTab === "agents" && (
            <AgentsTab
              agents={agents}
              onRefresh={fetchData}
              configData={configData}
              currentUserRole={currentUser?.role}
            />
          )}

          {/* --- CONTENIDO PESTAÑA: TICKETS --- */}
          {activeTab === "tickets" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  Listado de Tickets (
                  {ticketFilter === "ALL" ? "Todos" : "Pendientes"})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTicketFilter("ALL");
                      setPage(1);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      ticketFilter === "ALL"
                        ? "bg-sena-blue text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => {
                      setTicketFilter("PENDING");
                      setPage(1);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      ticketFilter === "PENDING"
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    Pendientes
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        ID
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Tipo
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Solicitante
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Categoría
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Agente
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingTickets ? (
                      <TicketsTableSkeleton />
                    ) : (
                      tickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setShowTicketModal(true);
                          }}
                        >
                          <td className="p-4 font-bold text-gray-800">
                            #{ticket.id}
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                ticket.ticket_type === "INC"
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {ticket.ticket_type || "REQ"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                ticket.status === "RESUELTO" ||
                                ticket.status === "CERRADO"
                                  ? "bg-green-100 text-green-700"
                                  : ticket.status === "EN_PROGRESO"
                                    ? "bg-blue-100 text-blue-700"
                                    : ticket.status === "EN_ESPERA"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-red-100 text-red-700"
                              }`}
                            >
                              {ticket.status}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-gray-700">
                            {ticket.users?.full_name}
                          </td>
                          <td className="p-4 text-sm text-gray-600">
                            {ticket.category}
                          </td>
                          <td className="p-4 text-sm text-gray-600">
                            {ticket.assigned_agent?.full_name || "Sin asignar"}
                          </td>
                          <td className="p-4 text-xs text-gray-500">
                            {new Date(
                              ticket.created_at || "",
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={page}
                totalCount={totalTicketsCount}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </section>
          )}

          {/* --- CONTENIDO PESTAÑA: FUNCIONARIOS --- */}
          {activeTab === "staff" && (
            <StaffTab
              usersList={usersList}
              onRefresh={fetchData}
              configData={configData}
              currentUserRole={currentUser?.role}
            />
          )}

          {/* --- CONTENIDO PESTAÑA: CONTRATISTAS --- */}
          {activeTab === "contractors" && (
            <ContractorsTab
              users={usersList}
              onRefresh={fetchData}
              currentUserRole={currentUser?.role}
            />
          )}

          {/* --- CONTENIDO PESTAÑA: AUDITORÍA --- */}
          {activeTab === "audit" && <AuditTab />}

          {/* --- CONTENIDO PESTAÑA: AUDITORÍA (Placeholder) --- */}
          {activeTab === "audit" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-gray-600">
                  Panel de Auditoría
                </h3>
                <p>Próximamente: Logs de acceso y cambios críticos.</p>
              </div>
            </div>
          )}

          {/* --- CONTENIDO PESTAÑA: TURNOS --- */}
          {activeTab === "shifts" && <ShiftsTab />}

          {/* --- CONTENIDO PESTAÑA: ACTIVOS --- */}
          {activeTab === "assets" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Inventario de Equipos
                </h2>
                <div className="flex gap-2">
                  {/* CARGA MASIVA */}
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

              {/* BUSCADOR ACTIVOS */}
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
                          onClick={() =>
                            setSelectedAssetSerial(asset.serial_number)
                          }
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
                          <td className="p-4 text-sm text-gray-800">
                            {asset.type}
                          </td>
                          <td className="p-4 font-mono text-xs font-bold text-gray-600">
                            {asset.serial_number}
                          </td>
                          <td className="p-4 text-sm text-gray-600">
                            {asset.location || "Sin ubicación"}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            {/* HISTORIAL */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssetForAction(asset);
                                setShowTimelineModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-sena-blue hover:bg-blue-50 rounded transition"
                              title="Ver Trazabilidad"
                            >
                              <Activity className="w-4 h-4" />
                            </button>

                            {currentUser?.role !== "admin" && (
                              <>
                                {/* TRASLADO */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAssetForAction(asset);
                                    setActionType("TRANSFER");
                                    setShowActionModal(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                  title="Trasladar Activo"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>

                                {/* DAR DE BAJA (Solo si no está ya dado de baja) */}
                                {asset.users?.full_name !==
                                  "Equipos de Baja" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAssetForAction(asset);
                                      setActionType("DECOMMISSION");
                                      setShowActionModal(true);
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
                        <td
                          colSpan={5}
                          className="p-8 text-center text-gray-500"
                        >
                          No hay equipos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* --- CONTENIDO PESTAÑA: CÓDIGOS QR --- */}
          {activeTab === "qr" && <QRGenerator areas={configData.areas} />}

          {/* --- CONTENIDO PESTAÑA: CONFIGURACIÓN --- */}
          {activeTab === "settings" && (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ÁREAS */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sena-blue" /> Gestión de Áreas
                </h3>
                {currentUser?.role !== "admin" && (
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Nueva área..."
                      className="flex-1 border p-2 rounded"
                      value={newConfigItem}
                      onChange={(e) => setNewConfigItem(e.target.value)}
                    />
                    <button
                      onClick={() => handleAddConfig("areas")}
                      className="bg-sena-green text-white px-4 py-2 rounded font-bold"
                    >
                      +
                    </button>
                  </div>
                )}
                <ul className="space-y-2">
                  {configData.areas.map((area) => (
                    <li
                      key={area.id}
                      className="flex justify-between items-center bg-gray-50 p-2 rounded"
                    >
                      <span>{area.name}</span>
                      {currentUser?.role !== "admin" && (
                        <button
                          onClick={() => handleDeleteConfig("areas", area.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CATEGORÍAS */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-500" /> Gestión de
                  Categorías
                </h3>
                {currentUser?.role !== "admin" && (
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Nueva categoría..."
                      className="flex-1 border p-2 rounded"
                      value={newConfigItem}
                      onChange={(e) => setNewConfigItem(e.target.value)}
                    />
                    <button
                      onClick={() => handleAddConfig("categories")}
                      className="bg-purple-600 text-white px-4 py-2 rounded font-bold"
                    >
                      +
                    </button>
                  </div>
                )}
                <ul className="space-y-2">
                  {configData.categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex justify-between items-center bg-gray-50 p-2 rounded"
                    >
                      <span>{cat.name}</span>
                      {currentUser?.role !== "admin" && (
                        <button
                          onClick={() =>
                            handleDeleteConfig("categories", cat.id)
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </main>

        {/* --- MODAL 1: CREAR/EDITAR USUARIO --- */}

        {/* --- MODAL 2: CREAR ACTIVO (INVENTARIO) --- */}
        {showAssetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-sena-green p-4 flex justify-between items-center text-white">
                <h3 className="font-bold flex gap-2">
                  <Monitor className="w-5 h-5" /> Nuevo Equipo
                </h3>
                <button
                  onClick={() => setShowAssetModal(false)}
                  className="hover:text-gray-200 font-bold text-xl"
                >
                  &times;
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Datos del Equipo
                  </label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <select
                      className="border p-3 rounded-lg w-full"
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
                      className="border p-3 rounded-lg w-full"
                      placeholder="Marca (HP, Dell)"
                      value={newAsset.brand}
                      onChange={(e) =>
                        setNewAsset({ ...newAsset, brand: e.target.value })
                      }
                    />
                  </div>
                  <input
                    type="text"
                    className="border p-3 rounded-lg w-full mt-3"
                    placeholder="Modelo (Ej: ProBook 450 G9)"
                    value={newAsset.model}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, model: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    className="border p-3 rounded-lg w-full mt-3 font-mono"
                    placeholder="SERIAL (S/N)"
                    value={newAsset.serial}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, serial: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    className="border p-3 rounded-lg w-full mt-3"
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
                        ...configData.areas.map((area) => area.name),
                      ]),
                    )
                      .sort()
                      .map((loc, index) => (
                        <option key={index} value={loc || ""} />
                      ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Asignar A:
                  </label>
                  <select
                    className="border p-3 rounded-lg w-full mt-1"
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
                    onClick={() => setShowAssetModal(false)}
                    className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateAsset}
                    className="flex-1 py-3 bg-sena-green hover:bg-green-700 text-white font-bold rounded-lg"
                  >
                    Registrar Equipo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showTicketModal && selectedTicket && (
          <React.Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            }
          >
            <TicketDetailsModal
              ticket={selectedTicket}
              onClose={() => setShowTicketModal(false)}
              agents={agents}
              onAssign={handleAssignTicket}
              onAddComment={handleAddComment}
              onUpdateStatus={handleUpdateStatus}
              currentUser={currentUser || undefined}
            />
          </React.Suspense>
        )}

        {/* --- MODAL 3: HISTORIAL DE ACTIVOS (LAZY) --- */}
        {showTimelineModal && selectedAssetForAction && (
          <React.Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            }
          >
            <AssetHistoryModal
              serialNumber={selectedAssetForAction.serial_number}
              onClose={() => setShowTimelineModal(false)}
            />
          </React.Suspense>
        )}

        {/* --- MODAL 4: ACCIONES ACTIVO (TRANSFER/BAJA) (LAZY) --- */}
        {showActionModal && selectedAssetForAction && (
          <React.Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            }
          >
            <AssetActionModal
              asset={{
                id: selectedAssetForAction.id,
                serial_number: selectedAssetForAction.serial_number,
                model: selectedAssetForAction.model || "",
                assigned_to_user_id:
                  selectedAssetForAction.assigned_to_user_id || "",
              }}
              action={actionType}
              currentUserId={currentUser?.id || ""}
              onClose={() => setShowActionModal(false)}
              onSuccess={() => {
                setShowActionModal(false);
                fetchData();
              }}
            />
          </React.Suspense>
        )}
      </div>
    </AuthGuard>
  );
}
