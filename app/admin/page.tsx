"use client";

import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { safeRemoveItem } from "@/lib/storage";
import {
  Shield,
  Users,
  Activity,
  UserPlus,
  BarChart3,
  Trash2,
  Monitor,
  Plus,
  Laptop,
  Download,
  PieChart as PieChartIcon,
  QrCode,
  Printer,
  LogOut,
  Edit,
  Key,
  Settings,
  FileSpreadsheet,
  Search,
  Clock,
  MapPin,
  LayoutDashboard,
  FileText,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import AssetHistoryModal from "@/components/AssetHistoryModal";
import AssetHistoryTimeline from "@/components/AssetHistoryTimeline";
import AssetActionModal from "@/components/AssetActionModal";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// --- TIPOS DE DATOS ---
interface Agent {
  id: string;
  full_name: string;
  username: string;
  role: string;
  area?: string;
  created_at: string;
  is_active: boolean;
  perm_create_assets: boolean;
  perm_transfer_assets: boolean;
  perm_decommission_assets: boolean;
}

interface ConfigItem {
  id: number;
  name: string;
  created_at?: string;
}

interface Asset {
  id: number;
  serial_number: string;
  type: string;
  brand: string;
  model: string;
  assigned_to_user_id: string;
  location?: string; // Nueva columna
  users?: { full_name: string }; // Join para saber de quién es
}

interface Ticket {
  id: number;
  created_at: string;
  status: string;
  category: string;
  location: string;
  description: string;
  users: { full_name: string } | null;
  assigned_agent?: { full_name: string } | null;
}

interface Stats {
  totalTickets: number;
  pendingTickets: number;
  totalAssets: number;
}

interface UserSimple {
  id: string;
  full_name: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  // Estados Generales
  const [activeTab, setActiveTab] = useState<
    "agents" | "assets" | "metrics" | "qr" | "settings" | "tickets"
  >("agents");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Buscador general
  const [selectedAssetSerial, setSelectedAssetSerial] = useState<string | null>(
    null
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
  const [tickets, setTickets] = useState<Ticket[]>([]); // Lista completa de tickets
  const [usersList, setUsersList] = useState<UserSimple[]>([]); // Para el select de asignar

  // Estado para métricas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metricsData, setMetricsData] = useState<any>({
    statusData: [],
    monthlyData: [],
    agentData: [],
    slaData: [], // Nuevo: Tiempos de resolución
  });

  // Estado para Configuración
  const [configData, setConfigData] = useState<{
    areas: ConfigItem[];
    categories: ConfigItem[];
  }>({ areas: [], categories: [] });
  const [newConfigItem, setNewConfigItem] = useState("");

  // Estado para QR
  const [qrLocation, setQrLocation] = useState("");

  // Estados Modales

  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);

  // Estados para Acciones de Activos
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAssetForAction, setSelectedAssetForAction] =
    useState<Asset | null>(null);
  const [actionType, setActionType] = useState<"TRANSFER" | "DECOMMISSION">(
    "TRANSFER"
  );
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    full_name: string;
  } | null>(null);

  // Forms
  const [newAgent, setNewAgent] = useState({
    id: "", // Para edición
    fullName: "",
    username: "",
    password: "",
    role: "agent",
    area: "Mesa de Ayuda",
    is_active: true,
    perm_create_assets: false,
    perm_transfer_assets: false,
    perm_decommission_assets: false,
    isEditing: false,
  });
  const [newAsset, setNewAsset] = useState({
    serial: "",
    type: "Portátil",
    brand: "",
    model: "",
    userId: "",
    location: "",
  });

  // --- 1. CARGA INICIAL DE DATOS ---
  const fetchData = async () => {
    setLoading(true);

    // 0. Obtener usuario actual
    const userStr = localStorage.getItem("tic_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentAdminName(user.full_name || "Super Admin");
      setCurrentUser(user);
    }

    // A. Cargar Agentes
    const { data: agentsData } = await supabase
      .from("users")
      .select("*")
      .in("role", ["agent", "admin"])
      .order("created_at", { ascending: false });
    if (agentsData) setAgents(agentsData as Agent[]);

    // B. Cargar Activos (con dueño)
    const { data: assetsData } = await supabase
      .from("assets")
      .select("*, users(full_name)")
      .order("created_at", { ascending: false });
    if (assetsData) setAssets(assetsData as unknown as Asset[]);

    // C. Cargar Lista de Usuarios (Para asignar equipos)
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("is_active", true);
    if (allUsers) setUsersList(allUsers);

    // D. Cargar Configuración (Áreas y Categorías)
    const { data: areasData } = await supabase
      .from("areas")
      .select("*")
      .order("name");
    const { data: catsData } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setConfigData({
      areas: areasData || [],
      categories: catsData || [],
    });

    // E. Estadísticas Rápidas y Datos para Gráficos
    const { data: allTickets, count: ticketCount } = await supabase
      .from("tickets")
      .select(
        "*, users:users!tickets_user_id_fkey(full_name), assigned_agent:users!tickets_assigned_agent_id_fkey(full_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (allTickets) setTickets(allTickets as unknown as Ticket[]);

    const { count: pendingCount } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDIENTE");

    setStats({
      totalTickets: ticketCount || 0,
      pendingTickets: pendingCount || 0,
      totalAssets: assetsData?.length || 0,
    });

    // PROCESAR DATOS PARA GRÁFICOS
    if (allTickets) {
      // 1. Por Estado
      const statusCounts = allTickets.reduce(
        (acc: Record<string, number>, ticket) => {
          acc[ticket.status] = (acc[ticket.status] || 0) + 1;
          return acc;
        },
        {}
      );
      const statusData = [
        {
          name: "Pendientes",
          value: statusCounts.PENDIENTE || 0,
          color: "#EF4444",
        },
        {
          name: "En Curso",
          value: statusCounts.EN_PROGRESO || 0,
          color: "#3B82F6",
        },
        {
          name: "Resueltos",
          value: statusCounts.RESUELTO || 0,
          color: "#22C55E",
        },
        {
          name: "En Espera",
          value: statusCounts.EN_ESPERA || 0,
          color: "#A855F7",
        },
      ].filter((d) => d.value > 0);

      // 2. Por Mes (Últimos 6 meses)
      const monthlyCounts = allTickets.reduce(
        (acc: Record<string, number>, ticket) => {
          const month = new Date(ticket.created_at).toLocaleString("es-CO", {
            month: "short",
          });
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        },
        {}
      );
      const monthlyData = Object.keys(monthlyCounts).map((key) => ({
        name: key,
        tickets: monthlyCounts[key],
      }));

      // 3. Top Agentes (Simulado por ahora ya que assigned_agent_id es string)
      // En un caso real, haríamos join con la tabla de agentes
      const agentCounts = allTickets.reduce(
        (acc: Record<string, number>, ticket) => {
          if (ticket.assigned_agent_id) {
            // Buscamos el nombre del agente en el estado 'agents'
            const agentName =
              agentsData?.find((a) => a.id === ticket.assigned_agent_id)
                ?.full_name || "Desconocido";
            acc[agentName] = (acc[agentName] || 0) + 1;
          }
          return acc;
        },
        {}
      );
      const agentData = Object.keys(agentCounts)
        .map((key) => ({
          name: key.split(" ")[0], // Solo primer nombre para el gráfico
          tickets: agentCounts[key],
        }))
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 5); // Top 5

      // 4. SLA: Tiempo Promedio de Resolución por Técnico (Horas)
      const agentSla: Record<string, { totalTime: number; count: number }> = {};

      allTickets.forEach((t) => {
        if (t.status === "RESUELTO" || t.status === "CERRADO") {
          if (t.assigned_agent_id && t.updated_at && t.created_at) {
            const start = new Date(t.created_at).getTime();
            const end = new Date(t.updated_at).getTime();
            const hours = (end - start) / (1000 * 60 * 60); // Horas

            const agentName =
              agentsData?.find((a) => a.id === t.assigned_agent_id)
                ?.full_name || "Desconocido";

            if (!agentSla[agentName])
              agentSla[agentName] = { totalTime: 0, count: 0 };
            agentSla[agentName].totalTime += hours;
            agentSla[agentName].count += 1;
          }
        }
      });

      const slaData = Object.keys(agentSla)
        .map((name) => ({
          name: name.split(" ")[0],
          hours: Math.round(agentSla[name].totalTime / agentSla[name].count),
        }))
        .sort((a, b) => a.hours - b.hours); // Menor tiempo es mejor

      setMetricsData({ statusData, monthlyData, agentData, slaData });
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. LOGICA AGENTES / USUARIOS ---
  const handleCreateOrUpdateUser = async () => {
    if (!newAgent.fullName || !newAgent.username || !newAgent.password)
      return alert("Faltan datos obligatorios (Nombre, Usuario, Contraseña)");

    try {
      if (newAgent.isEditing) {
        // ACTUALIZAR
        const { error } = await supabase
          .from("users")
          .update({
            full_name: newAgent.fullName,
            username: newAgent.username.toLowerCase(),
            role: newAgent.role,
            area: newAgent.area,
            password: newAgent.password,
            is_active: newAgent.is_active,
            perm_create_assets: newAgent.perm_create_assets,
            perm_transfer_assets: newAgent.perm_transfer_assets,
            perm_decommission_assets: newAgent.perm_decommission_assets,
          })
          .eq("id", newAgent.id);
        if (error) throw error;
        alert("✅ Usuario actualizado");
      } else {
        // CREAR
        const { error } = await supabase.from("users").insert({
          full_name: newAgent.fullName,
          username: newAgent.username.toLowerCase(),
          role: newAgent.role,
          area: newAgent.area,
          password: newAgent.password,
          is_active: newAgent.is_active,
          perm_create_assets: newAgent.perm_create_assets,
          perm_transfer_assets: newAgent.perm_transfer_assets,
          perm_decommission_assets: newAgent.perm_decommission_assets,
        });
        if (error) throw error;
        alert("✅ Usuario creado");
      }

      setShowAgentModal(false);
      resetUserForm();
      fetchData();
    } catch {
      alert("Error al guardar. Verifica si el usuario ya existe.");
    }
  };

  const handleEditUser = (user: Agent) => {
    setNewAgent({
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      password: (user as any).password || "",
      role: user.role,
      area: user.area || "",
      is_active: user.is_active,
      perm_create_assets: user.perm_create_assets,
      perm_transfer_assets: user.perm_transfer_assets,
      perm_decommission_assets: user.perm_decommission_assets,
      isEditing: true,
    });
    setShowAgentModal(true);
  };

  const resetUserForm = () => {
    setNewAgent({
      id: "",
      fullName: "",
      username: "",
      password: "",
      role: "agent",
      area: "Mesa de Ayuda",
      is_active: true,
      perm_create_assets: false,
      perm_transfer_assets: false,
      perm_decommission_assets: false,
      isEditing: false,
    });
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

    try {
      const { error } = await supabase.from("users").delete().eq("id", id);

      if (error) {
        if (error.code === "23503") {
          alert(
            "❌ No se puede eliminar este usuario porque tiene tickets o activos asignados.\n\nPor favor, reasigna sus responsabilidades antes de eliminarlo."
          );
        } else {
          throw error;
        }
      } else {
        alert("✅ Usuario eliminado correctamente");
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(
        "Error al eliminar el usuario. Consulta la consola para más detalles."
      );
    }
  };

  const handleLogout = () => {
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
    } catch (error) {
      console.error(error);
      alert("Error creando activo. El serial podría estar duplicado.");
    }
  };

  // --- 3.1 CARGA MASIVA DE ACTIVOS ---
  const handleDownloadTemplate = () => {
    const headers = "Serial,Tipo,Marca,Modelo,Ubicacion";
    const blob = new Blob(
      [`\uFEFF${headers}\nEJ123,Portátil,HP,ProBook,Sede Central`],
      { type: "text/csv;charset=utf-8;" }
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
          c.trim()
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
        else successCount++;
      }

      alert(
        `Carga finalizada:\n✅ ${successCount} creados\n❌ ${errorCount} fallidos (posibles duplicados)`
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
    id: number
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
        `reporte_gestion_tic_${new Date().toISOString().split("T")[0]}.csv`
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
    <AuthGuard allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-100 font-sans">
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
              model: selectedAssetForAction.model,
              assigned_to_user_id: selectedAssetForAction.assigned_to_user_id,
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
            <div
              className="h-10 w-10 rounded-full bg-sena-green flex items-center justify-center font-bold border-2 border-white cursor-default"
              title="Admin"
            >
              AD
            </div>
            <button
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl mx-auto space-y-8">
          {/* --- KPIs --- */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              onClick={() => {
                setActiveTab("tickets");
                setTicketFilter("ALL");
              }}
              className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-sena-green flex justify-between items-center cursor-pointer hover:shadow-md transition"
            >
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase">
                  Gestión Total
                </p>
                <h2 className="text-3xl font-bold text-gray-800">
                  {stats.totalTickets}{" "}
                  <span className="text-sm font-normal text-gray-400">
                    tickets
                  </span>
                </h2>
              </div>
              <Activity className="w-10 h-10 text-sena-green opacity-20" />
            </div>
            <div
              onClick={() => {
                setActiveTab("tickets");
                setTicketFilter("PENDING");
              }}
              className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-red-500 flex justify-between items-center cursor-pointer hover:shadow-md transition"
            >
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase">
                  Pendientes
                </p>
                <h2 className="text-3xl font-bold text-gray-800">
                  {stats.pendingTickets}{" "}
                  <span className="text-sm font-normal text-gray-400">
                    casos
                  </span>
                </h2>
              </div>
              <BarChart3 className="w-10 h-10 text-red-500 opacity-20" />
            </div>
            <div
              onClick={() => setActiveTab("assets")}
              className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-blue-500 flex justify-between items-center cursor-pointer hover:shadow-md transition"
            >
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase">
                  Inventario Total
                </p>
                <h2 className="text-3xl font-bold text-gray-800">
                  {stats.totalAssets}{" "}
                  <span className="text-sm font-normal text-gray-400">
                    equipos
                  </span>
                </h2>
              </div>
              <Monitor className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </section>

          {/* --- PESTAÑAS DE NAVEGACIÓN --- */}
          <div className="flex gap-4 border-b border-gray-300">
            <button
              onClick={() => setActiveTab("agents")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "agents"
                  ? "border-b-4 border-sena-blue text-sena-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users className="w-4 h-4" /> Personal de Mesa
            </button>
            <button
              onClick={() => setActiveTab("metrics")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "metrics"
                  ? "border-b-4 border-sena-blue text-sena-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <PieChartIcon className="w-4 h-4" /> Métricas y Gráficos
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "tickets"
                  ? "border-b-4 border-sena-blue text-sena-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <FileText className="w-4 h-4" /> Tickets
            </button>
            <button
              onClick={() => setActiveTab("assets")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "assets"
                  ? "border-b-4 border-sena-blue text-sena-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Laptop className="w-4 h-4" /> Inventario de Equipos
            </button>
            <button
              onClick={() => setActiveTab("qr")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "qr"
                  ? "border-b-4 border-sena-blue text-sena-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <QrCode className="w-4 h-4" /> Códigos QR
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "settings"
                  ? "border-b-4 border-sena-blue text-sena-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Settings className="w-4 h-4" /> Configuración
            </button>
          </div>

          {/* --- CONTENIDO PESTAÑA: MÉTRICAS --- */}
          {activeTab === "metrics" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* GRÁFICO 1: ESTADO DE TICKETS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-sena-blue" />{" "}
                    Distribución de Casos
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metricsData.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {metricsData.statusData.map(
                            (
                              entry: {
                                name: string;
                                value: number;
                                color: string;
                              },
                              index: number
                            ) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            )
                          )}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* GRÁFICO 2: TOP AGENTES */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-sena-green" /> Top Agentes
                    (Tickets)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsData.agentData} layout="vertical">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip />
                        <Bar
                          dataKey="tickets"
                          fill="#39A900"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* GRÁFICO 3: EVOLUCIÓN MENSUAL (Ocupa todo el ancho) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
                  <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />{" "}
                    Solicitudes por Mes
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsData.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="tickets"
                          fill="#00324D"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* GRÁFICO 4: SLA (TIEMPO RESOLUCIÓN) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
                  <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" /> Tiempo
                    Promedio de Resolución (Horas)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsData.slaData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value} horas`} />
                        <Bar
                          dataKey="hours"
                          fill="#F97316"
                          radius={[4, 4, 0, 0]}
                          name="Horas Promedio"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* --- CONTENIDO PESTAÑA: CÓDIGOS QR --- */}
          {activeTab === "qr" && (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Generador de Etiquetas QR
                  </h2>
                  <p className="text-gray-500">
                    Crea códigos QR para pegar en las salas. Al escanearlos, los
                    usuarios reportarán fallas con la ubicación ya configurada.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Nombre de la Ubicación / Sala
                    </label>
                    <input
                      type="text"
                      value={qrLocation}
                      onChange={(e) => setQrLocation(e.target.value)}
                      placeholder="Ej: Sala de Juntas - Bloque A"
                      className="w-full border-2 border-gray-200 p-4 rounded-xl text-lg focus:border-sena-blue focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                    />
                  </div>

                  {qrLocation && (
                    <div className="bg-gray-50 p-8 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center animate-in zoom-in duration-300">
                      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                        <QRCode
                          value={`${
                            typeof window !== "undefined"
                              ? window.location.origin
                              : ""
                          }/?location=${encodeURIComponent(qrLocation)}`}
                          size={200}
                        />
                      </div>
                      <p className="font-bold text-gray-800 text-lg mb-1">
                        {qrLocation}
                      </p>
                      <p className="text-xs text-gray-400 mb-6">
                        Escanear para reportar falla aquí
                      </p>

                      <button
                        onClick={() => window.print()}
                        className="bg-sena-blue hover:bg-blue-800 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                      >
                        <Printer className="w-5 h-5" /> Imprimir Etiqueta
                      </button>
                    </div>
                  )}

                  {!qrLocation && (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <QrCode className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Escribe una ubicación para generar el código</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* --- CONTENIDO PESTAÑA: AGENTES / USUARIOS --- */}
          {activeTab === "agents" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  Gestión de Usuarios (Técnicos y Admins)
                </h2>
                <button
                  onClick={() => {
                    resetUserForm();
                    setShowAgentModal(true);
                  }}
                  className="bg-sena-blue hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
                >
                  <UserPlus className="w-4 h-4" /> Nuevo Usuario
                </button>
              </div>

              {/* BUSCADOR AGENTES */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, usuario o área..."
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
                        Nombre
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Usuario
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Rol
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">
                        Área
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {agents
                      .filter(
                        (a) =>
                          a.full_name
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          a.username
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          (a.area || "")
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())
                      )
                      .map((agent) => (
                        <tr
                          key={agent.id}
                          className="hover:bg-gray-50 transition"
                        >
                          <td className="p-4 font-medium text-gray-800">
                            {agent.full_name}
                          </td>
                          <td className="p-4 text-gray-600">
                            {agent.username}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                agent.role === "admin"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {agent.role === "admin"
                                ? "Super Admin"
                                : "Técnico"}
                            </span>
                          </td>
                          <td className="p-4 text-gray-500">
                            {agent.area || "-"}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button
                              onClick={() => handleEditUser(agent)}
                              className="text-gray-400 hover:text-sena-blue p-1"
                              title="Editar Usuario"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(agent.id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Eliminar Usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
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
                    onClick={() => setTicketFilter("ALL")}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      ticketFilter === "ALL"
                        ? "bg-sena-blue text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setTicketFilter("PENDING")}
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
                    {tickets
                      .filter(
                        (t) =>
                          ticketFilter === "ALL" || t.status === "PENDIENTE"
                      )
                      .map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50">
                          <td className="p-4 font-bold text-gray-800">
                            #{ticket.id}
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
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

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

                  <button
                    onClick={() => setShowAssetModal(true)}
                    className="bg-sena-blue hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Equipo
                  </button>
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
                          a.model
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          (a.users?.full_name || "")
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())
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
                            {asset.users?.full_name !== "Equipos de Baja" && (
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

          {/* --- CONTENIDO PESTAÑA: CONFIGURACIÓN --- */}
          {activeTab === "settings" && (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ÁREAS */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sena-blue" /> Gestión de Áreas
                </h3>
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
                <ul className="space-y-2">
                  {configData.areas.map((area) => (
                    <li
                      key={area.id}
                      className="flex justify-between items-center bg-gray-50 p-2 rounded"
                    >
                      <span>{area.name}</span>
                      <button
                        onClick={() => handleDeleteConfig("areas", area.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                <ul className="space-y-2">
                  {configData.categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex justify-between items-center bg-gray-50 p-2 rounded"
                    >
                      <span>{cat.name}</span>
                      <button
                        onClick={() => handleDeleteConfig("categories", cat.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </main>

        {/* --- MODAL 1: CREAR/EDITAR USUARIO --- */}
        {showAgentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
              <h3 className="font-bold text-xl mb-4 text-gray-800">
                {newAgent.isEditing ? "Editar Usuario" : "Nuevo Usuario"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Nombre Completo
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-2"
                    value={newAgent.fullName}
                    onChange={(e) =>
                      setNewAgent({ ...newAgent, fullName: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Usuario
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-lg p-2"
                      value={newAgent.username}
                      onChange={(e) =>
                        setNewAgent({ ...newAgent, username: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Rol
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2"
                      value={newAgent.role}
                      onChange={(e) =>
                        setNewAgent({ ...newAgent, role: e.target.value })
                      }
                    >
                      <option value="agent">Técnico</option>
                      <option value="admin">Super Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type="text" // Visible para facilitar gestión
                      className="w-full border border-gray-300 rounded-lg p-2 pl-8 font-mono text-sm"
                      value={newAgent.password}
                      onChange={(e) =>
                        setNewAgent({ ...newAgent, password: e.target.value })
                      }
                      placeholder="Asignar clave..."
                    />
                    <Key className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Área
                  </label>
                  <select
                    value={newAgent.area}
                    onChange={(e) =>
                      setNewAgent({ ...newAgent, area: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    {configData.areas.map((area) => (
                      <option key={area.id} value={area.name}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PERMISOS Y ESTADO */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                    Permisos y Estado
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAgent.is_active}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-sena-green rounded focus:ring-sena-green"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Usuario Activo (Puede iniciar sesión)
                    </span>
                  </label>

                  {newAgent.role === "agent" && (
                    <>
                      <div className="h-px bg-gray-200 my-2"></div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAgent.perm_create_assets}
                          onChange={(e) =>
                            setNewAgent({
                              ...newAgent,
                              perm_create_assets: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                          Permitir <strong>Crear Activos</strong>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAgent.perm_transfer_assets}
                          onChange={(e) =>
                            setNewAgent({
                              ...newAgent,
                              perm_transfer_assets: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                          Permitir <strong>Trasladar Activos</strong>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAgent.perm_decommission_assets}
                          onChange={(e) =>
                            setNewAgent({
                              ...newAgent,
                              perm_decommission_assets: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-600">
                          Permitir <strong>Dar de Baja</strong> (Requiere
                          soporte)
                        </span>
                      </label>
                    </>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAgentModal(false)}
                    className="flex-1 text-gray-500 hover:bg-gray-100 py-2 rounded-lg font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateOrUpdateUser}
                    className="flex-1 bg-sena-blue hover:bg-blue-900 text-white py-2 rounded-lg font-bold"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  />
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
      </div>
    </AuthGuard>
  );
}
