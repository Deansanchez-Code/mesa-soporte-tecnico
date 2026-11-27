"use client";

import AuthGuard from "@/components/AuthGuard";
import { useEffect, useMemo, useState } from "react";
import React from "react";
import { supabase } from "@/lib/supabase/client";
import { safeRemoveItem } from "@/lib/storage";
import {
  Shield,
  Users,
  Laptop,
  Download,
  PieChart as PieChartIcon,
  QrCode,
  LogOut,
  Settings,
  LayoutDashboard,
  FileText,
  ShieldAlert,
  Loader2,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-[#39A900]" />
      <span className="text-sm font-medium">Cargando módulo...</span>
    </div>
  );
}

const QRGenerator = dynamic(
  () => import("@/features/tickets/components/QRGenerator"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const AgentsTab = dynamic(
  () => import("@/features/users/components/AgentsTab"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const StaffTab = dynamic(() => import("@/features/users/components/StaffTab"), {
  ssr: false,
  loading: () => <TabLoadingFallback />,
});
const ContractorsTab = dynamic(
  () => import("@/features/contractors/components/ContractorsTab"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const MetricsTab = dynamic(
  () => import("@/features/monitoring/components/MetricsTab"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const ShiftsTab = dynamic(
  () => import("@/features/shifts/components/ShiftsTab"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const AuditTab = dynamic(() => import("@/features/audit/components/AuditTab"), {
  ssr: false,
  loading: () => <TabLoadingFallback />,
});
const DraggableDashboard = dynamic(
  () =>
    import("@/features/monitoring/components/Dashboards/DraggableDashboard"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const AdminAssetsTab = dynamic(
  () => import("@/features/assets/components/AdminAssetsTab"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
const AdminSpacesTab = dynamic(
  () => import("@/features/reservations/components/AdminSpacesTab"),
  { ssr: false, loading: () => <TabLoadingFallback /> },
);
import { toast } from "sonner";

import {
  Agent,
  User,
  ConfigItem,
  Asset,
  Ticket,
  Stats,
  AdminTab,
  TicketFilterType,
} from "@/app/admin/admin.types";
import { TicketsTableSkeleton } from "@/components/ui/skeletons/TicketsTableSkeleton";
import AssetHistoryTimeline from "@/features/assets/components/AssetHistoryTimeline";

const AssetHistoryModal = React.lazy(
  () => import("@/features/assets/components/AssetHistoryModal"),
);
const AssetActionModal = React.lazy(
  () => import("@/features/assets/components/AssetActionModal"),
);
const TicketDetailsModal = React.lazy(
  () => import("@/features/tickets/components/TicketDetailsModal"),
);
const UserProfileModal = React.lazy(
  () => import("@/components/shared/UserProfileModal"),
);
import { useTicketsQuery } from "@/features/tickets/hooks/useTicketsQuery";
import PaginationControls from "@/components/ui/PaginationControls";
import { calculateSLADueDate, getSLAHours } from "@/lib/domain/sla-calculator";
import { isAfter, subHours } from "date-fns";

// --- TIPOS DE DATOS ---

import { useUserProfile } from "@/features/auth/hooks/useUserProfile";

export default function AdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const [activeTab, setActiveTab] = useState<AdminTab>("agents");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedAssetSerial, setSelectedAssetSerial] = useState<string | null>(
    null,
  ); // Modal historial
  const [currentAdminName, setCurrentAdminName] = useState("Super Admin");
  const [ticketFilter, setTicketFilter] = useState<TicketFilterType>("ALL"); // Filtro para la pestaña de tickets

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

  // Estados Modales
  const [showProfileModal, setShowProfileModal] = useState(false); // Estado para modal de perfil

  // Estados para Acciones de Activos
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAssetForAction, setSelectedAssetForAction] =
    useState<Asset | null>(null);
  const [actionType, setActionType] = useState<"TRANSFER" | "DECOMMISSION">(
    "TRANSFER",
  );

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
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  // Función para agregar comentario/trazabilidad
  const handleAddComment = async (ticketId: number, comment: string) => {
    if (!selectedTicket || !currentUser) return;

    // 1. Insertar el evento de comentario en ticket_events
    const { error: eventError } = await supabase.from("ticket_events").insert({
      ticket_id: ticketId,
      actor_id: currentUser.id,
      action_type: "COMMENT_ADDED",
      comment: comment,
    });

    if (eventError) {
      console.error(eventError);
      alert("Error al guardar el comentario.");
      throw eventError;
    }

    // 2. Actualizar el updated_at del ticket
    await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  // Función para actualizar estado con trazabilidad
  const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
    if (!selectedTicket || !currentUser) return;

    // 1. Insertar el evento de cambio de estado en ticket_events
    const { error: eventError } = await supabase.from("ticket_events").insert({
      ticket_id: ticketId,
      actor_id: currentUser.id,
      action_type: "STATUS_CHANGE",
      old_value: selectedTicket.status,
      new_value: newStatus,
      comment: `Cambio de estado a ${newStatus}`,
    });

    if (eventError) {
      console.error(eventError);
      alert("Error al registrar el cambio de estado.");
      throw eventError;
    }

    // 2. Actualizar el estado del ticket en tickets
    const { error: ticketError } = await supabase
      .from("tickets")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (ticketError) {
      console.error(ticketError);
      alert("Error actualizando estado del ticket.");
      throw ticketError;
    }

    // Actualizar estado local
    setSelectedTicket({
      ...selectedTicket,
      status: newStatus,
    });
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
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

          let res = await fetch("/api/admin/users?limit=2000", { headers });
          if (res.status === 401) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed.session?.access_token) {
              res = await fetch("/api/admin/users?limit=2000", {
                headers: {
                  Authorization: `Bearer ${refreshed.session.access_token}`,
                },
              });
            }
          }
          if (res.status === 401) {
            toast.error(
              "Tu sesión expiró. Por favor inicia sesión nuevamente.",
            );
            router.push("/login");
            return { data: [] };
          }
          if (!res.ok) {
            console.warn("API User fetch failed, status:", res.status);
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
    // --- LOGS DE DEPURACIÓN (REMOVED) ---

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
  }, [currentUser, router, totalTicketsCount]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [currentUser, fetchData]);

  // --- 2. LOGICA AGENTES / USUARIOS ---

  // --- CARGUE MASIVO DE FUNCIONARIOS ---

  const handleLogout = async () => {
    await supabase.auth.signOut();
    safeRemoveItem("tic_user");
    router.push("/login");
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
              <LayoutDashboard className="w-4 h-4" /> Ir a Gestión de Ambientes
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
                  <button
                    onClick={() => {
                      setTicketFilter("VIP");
                      setPage(1);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      ticketFilter === "VIP"
                        ? "bg-amber-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    Críticos (VIP)
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-h-[600px] overflow-y-auto relative">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
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
                      tickets.map((ticket) => {
                        // Lógica de urgencia (< 1h para vencer)
                        const slaHours = getSLAHours(ticket);
                        const created =
                          ticket.created_at || new Date().toISOString();
                        const dueDate = ticket.sla_expected_end_at
                          ? new Date(ticket.sla_expected_end_at)
                          : calculateSLADueDate(created, slaHours);

                        const isResolved =
                          ticket.status === "RESUELTO" ||
                          ticket.status === "CERRADO" ||
                          ticket.status === "CANCELADO";
                        const isExpiringSoon =
                          !isResolved &&
                          isAfter(new Date(), subHours(dueDate, 1)) &&
                          isAfter(dueDate, new Date());

                        return (
                          <tr
                            key={ticket.id}
                            className={`hover:bg-gray-50 cursor-pointer transition relative ${
                              isExpiringSoon
                                ? "bg-amber-50/50 border-l-[4px] border-l-amber-500"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setShowTicketModal(true);
                            }}
                          >
                            <td className="p-4 font-bold text-gray-800">
                              #{ticket.id}
                              {ticket.is_vip_ticket && (
                                <span className="ml-2 bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-full border border-amber-200">
                                  VIP
                                </span>
                              )}
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
                                    : ticket.status === "CANCELADO"
                                      ? "bg-gray-100 text-gray-500"
                                      : ticket.status === "EN_PROGRESO"
                                        ? "bg-blue-100 text-blue-700"
                                        : ticket.status === "EN_ESPERA"
                                          ? "bg-purple-100 text-purple-700"
                                          : "bg-red-100 text-red-700"
                                }`}
                              >
                                {ticket.status}
                              </span>
                              {isExpiringSoon && (
                                <span className="ml-2 inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                              )}
                            </td>
                            <td className="p-4 text-sm text-gray-700">
                              {ticket.users?.full_name}
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {ticket.category}
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {ticket.assigned_agent?.full_name ||
                                "Sin asignar"}
                            </td>
                            <td className="p-4 text-xs text-gray-500">
                              {new Date(
                                ticket.created_at || "",
                              ).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })
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
              configData={configData}
            />
          )}

          {/* --- CONTENIDO PESTAÑA: AUDITORÍA --- */}
          {activeTab === "audit" && <AuditTab />}

          {/* --- CONTENIDO PESTAÑA: TURNOS --- */}
          {activeTab === "shifts" && <ShiftsTab />}

          {/* --- CONTENIDO PESTAÑA: ACTIVOS --- */}
          {activeTab === "assets" && (
            <AdminAssetsTab
              assets={assets}
              usersList={usersList}
              areas={configData.areas}
              currentUser={currentUser}
              loading={loading}
              onRefresh={fetchData}
              onSelectAssetSerial={(serial) => setSelectedAssetSerial(serial)}
              onOpenTimeline={(asset) => {
                setSelectedAssetForAction(asset);
                setShowTimelineModal(true);
              }}
              onOpenAction={(asset, action) => {
                setSelectedAssetForAction(asset);
                setActionType(action);
                setShowActionModal(true);
              }}
            />
          )}

          {/* --- CONTENIDO PESTAÑA: CÓDIGOS QR --- */}
          {activeTab === "qr" && <QRGenerator areas={configData.areas} />}

          {/* --- CONTENIDO PESTAÑA: CONFIGURACIÓN --- */}
          {activeTab === "settings" && (
            <AdminSpacesTab
              currentUser={currentUser}
              areas={configData.areas}
              categories={configData.categories}
              usersList={usersList}
              onRefreshConfig={fetchData}
            />
          )}
        </main>

        {/* --- MODAL 1: CREAR/EDITAR USUARIO --- */}

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
