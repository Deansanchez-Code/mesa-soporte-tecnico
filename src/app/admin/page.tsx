"use client";

import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import { supabase } from "@/lib/supabase/client";
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
  X,
  CheckCircle2,
  Pencil,
  Power,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRGenerator from "@/features/tickets/components/QRGenerator";
import AgentsTab from "@/features/users/components/AgentsTab";
import StaffTab from "@/features/users/components/StaffTab";
import ContractorsTab from "@/features/contractors/components/ContractorsTab";
import MetricsTab from "@/features/monitoring/components/MetricsTab";
import ShiftsTab from "@/features/shifts/components/ShiftsTab";
import AuditTab from "@/features/audit/components/AuditTab";
import {
  getAllSpacesMaintenanceAction,
  saveSpaceMaintenanceAction,
  disableSpaceMaintenanceAction,
  getEnvironmentsGlobalConfigAction,
  toggleSpaceStatusBySuperAdminAction,
  saveEnvironmentsTabOrderAction,
  assignSpaceCoordinatorAction,
  getAssignableUsersAction,
  DEFAULT_SPACE_COORDINATORS,
  AssignableUser,
} from "@/features/reservations/actions/reservationActions";
import { SPECIAL_SPACES_CATALOG } from "@/features/reservations/services/maintenanceService";
import {
  SpaceMaintenanceConfig,
  EnvironmentsGlobalConfig,
} from "@/features/reservations/types";
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
import DraggableDashboard from "@/features/monitoring/components/Dashboards/DraggableDashboard";
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
  const [searchTerm, setSearchTerm] = useState(""); // Buscador general
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
  const [newConfigItem, setNewConfigItem] = useState("");

  const [maintenanceConfig, setMaintenanceConfig] =
    useState<SpaceMaintenanceConfig>({
      is_active: false,
      space_id: "1",
      space_name: "Auditorio 103",
      start_date: "2026-09-01",
      end_date: null,
      custom_title: "Auditorio 103 en Remodelación",
      custom_message: "",
    });
  const [spacesMaintenanceMap, setSpacesMaintenanceMap] = useState<
    Record<string, SpaceMaintenanceConfig>
  >({});
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  const [envGlobalConfig, setEnvGlobalConfig] =
    useState<EnvironmentsGlobalConfig>({
      tab_order: [],
      disabled_area_ids: [],
      disabled_special_spaces: [],
      coordinators: {},
    });

  const [assignableStaffUsers, setAssignableStaffUsers] = useState<
    AssignableUser[]
  >([]);
  const [isLoadingAssignableUsers, setIsLoadingAssignableUsers] =
    useState(false);
  const [selectedSpaceForCoord, setSelectedSpaceForCoord] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedCoordUserId, setSelectedCoordUserId] = useState("");
  const [isAssigningCoord, setIsAssigningCoord] = useState(false);
  const [coordSearchQuery, setCoordSearchQuery] = useState("");

  const availableMaintenanceSpaces = useMemo(() => {
    const special = SPECIAL_SPACES_CATALOG.map((s) => ({
      id: s.id,
      name: s.name,
      group: "Espacios de Reserva Institucional",
    }));
    const extraAreas = configData.areas
      .filter((a) => {
        const up = a.name.toUpperCase();
        return (
          (up.includes("AMBIENTE") ||
            up.includes("AUDITORIO") ||
            up.includes("SUBDIRECCIÓN") ||
            up.includes("BIBLIOTECA") ||
            up.includes("COCINA")) &&
          !up.includes("KIOSKO") &&
          !up.includes("INSTRUCTORES") &&
          !up.includes("AUDITORIO") &&
          !up.includes("SUBDIRECCIÓN") &&
          !up.includes("BIBLIOTECA") &&
          !up.includes("107") &&
          !up.includes("COCINA")
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: `area:${a.id}`,
        name: a.name,
        group: "Ambientes de Formación (Calendario)",
      }));
    return { special, extraAreas, all: [...special, ...extraAreas] };
  }, [configData.areas]);

  const pausedSpacesList = useMemo(
    () =>
      Object.values(spacesMaintenanceMap)
        .filter((cfg) => Boolean(cfg?.is_active))
        .sort((a, b) =>
          (a.space_name || a.space_id).localeCompare(
            b.space_name || b.space_id,
          ),
        ),
    [spacesMaintenanceMap],
  );

  const coordinatorCandidateUsers = useMemo(() => {
    const baseList: AssignableUser[] =
      assignableStaffUsers.length > 0
        ? assignableStaffUsers
        : usersList
            .filter((u) => u.is_active !== false)
            .map((u) => ({
              id: u.id,
              full_name: u.full_name,
              username: u.username || (u.email ? u.email.split("@")[0] : ""),
              email: u.email,
              role: u.role,
              job_category: u.job_category || null,
              employment_type: u.employment_type || null,
              area: u.area || null,
              is_vip: !!u.is_vip,
            }));

    return [...baseList].sort((a, b) => {
      const aPriority =
        a.is_vip ||
        a.role === "coordinator" ||
        (a.job_category || "").toLowerCase().includes("coordinador") ||
        (a.employment_type || "").toLowerCase().includes("planta")
          ? 0
          : 1;
      const bPriority =
        b.is_vip ||
        b.role === "coordinator" ||
        (b.job_category || "").toLowerCase().includes("coordinador") ||
        (b.employment_type || "").toLowerCase().includes("planta")
          ? 0
          : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [assignableStaffUsers, usersList]);

  useEffect(() => {
    getAllSpacesMaintenanceAction().then((res) => {
      if (res?.configs) {
        setSpacesMaintenanceMap(res.configs);
        if (res.configs["1"]) {
          setMaintenanceConfig(res.configs["1"]);
        }
      }
    });
    getEnvironmentsGlobalConfigAction().then((res) => {
      if (res?.config) {
        setEnvGlobalConfig(res.config);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setIsLoadingAssignableUsers(true);
      getAssignableUsersAction(data.session?.access_token)
        .then((res) => {
          if (res?.success && res.users) {
            setAssignableStaffUsers(res.users);
          }
        })
        .finally(() => setIsLoadingAssignableUsers(false));
    });
  }, []);

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

    fetchData(); // Refresh list (background)
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

    if (error) {
      console.error(`Error adding ${type}:`, error);
      if (error.code === "23505") {
        alert("Error: Este elemento ya existe (duplicado).");
      } else if (error.code === "42501") {
        alert(
          "Error de permisos: No tienes autorización para crear este elemento.",
        );
      } else {
        alert(`Error al guardar: ${error.message}`);
      }
    } else {
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
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {configData.areas.map((area) => {
                    const isAreaDisabled =
                      envGlobalConfig.disabled_area_ids.includes(area.id);
                    const isSuperAdminRole =
                      (currentUser?.role || "").toLowerCase() === "superadmin";
                    return (
                      <li
                        key={area.id}
                        className={`flex justify-between items-center p-2.5 rounded-lg border transition ${
                          isAreaDisabled
                            ? "bg-red-50/60 border-red-200 text-red-700"
                            : "bg-gray-50 border-gray-100 text-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-sm font-medium truncate ${
                              isAreaDisabled ? "line-through opacity-75" : ""
                            }`}
                          >
                            {area.name}
                          </span>
                          {isAreaDisabled && (
                            <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              Inhabilitado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSuperAdminRole && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res =
                                  await toggleSpaceStatusBySuperAdminAction({
                                    areaId: area.id,
                                    enabled: isAreaDisabled,
                                  });
                                if (res.error) {
                                  toast.error(res.error);
                                  return;
                                }
                                if (res.config) {
                                  setEnvGlobalConfig(res.config);
                                  toast.success(
                                    isAreaDisabled
                                      ? `Espacio "${area.name}" HABILITADO.`
                                      : `Espacio "${area.name}" DESHABILITADO.`,
                                  );
                                }
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                !isAreaDisabled
                                  ? "bg-sena-green"
                                  : "bg-gray-300"
                              }`}
                              title={
                                isAreaDisabled
                                  ? "Espacio Inhabilitado (Clic para Habilitar)"
                                  : "Espacio Habilitado (Clic para Deshabilitar)"
                              }
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  !isAreaDisabled
                                    ? "translate-x-4"
                                    : "translate-x-0"
                                }`}
                              />
                            </button>
                          )}
                          {isSuperAdminRole && (
                            <button
                              onClick={() =>
                                handleDeleteConfig("areas", area.id)
                              }
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Eliminar Área"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
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

              {/* CONTROL MAESTRO DE ESPACIOS Y RESERVAS (EXCLUSIVO SUPERADMIN) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-sena-blue/20 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sena-blue text-white flex items-center justify-center shadow-sm">
                      <Shield className="w-5 h-5 text-sena-green" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sena-blue text-base">
                          Control Maestro de Habilitación de Espacios yOrden de
                          Pestañas
                        </h3>
                        <span className="text-[10px] font-black uppercase bg-sena-blue/10 text-sena-blue px-2.5 py-0.5 rounded-full">
                          Poder Exclusivo SuperAdmin
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        El SuperAdmin es el único con potestad para habilitar o
                        deshabilitar espacios de reserva y formación en toda la
                        plataforma.
                      </p>
                    </div>
                  </div>
                </div>

                {(currentUser?.role || "").toLowerCase() !== "superadmin" ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    Únicamente el rol SuperAdmin puede habilitar o deshabilitar
                    espacios institucionales desde este panel.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* 1. Espacios Principales de Reserva (Card 2 del Kiosko/Portal) */}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                        Espacios de Reserva Institucional (Tarjetas del Portal y
                        Formulario)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {[
                          {
                            id: "1",
                            name: "Auditorio 103",
                            desc: "Capacitaciones y eventos",
                          },
                          {
                            id: "2",
                            name: "Subdirección",
                            desc: "Reuniones gerenciales",
                          },
                          {
                            id: "3",
                            name: "Biblioteca",
                            desc: "Entornos de aprendizaje",
                          },
                          {
                            id: "4",
                            name: "Ambiente 107",
                            desc: "Prerreserva Coordinación",
                          },
                          {
                            id: "5",
                            name: "Ambiente de Cocina",
                            desc: "Prerreserva Gastronomía",
                          },
                        ].map((sp) => {
                          const isDisabled =
                            envGlobalConfig.disabled_special_spaces.includes(
                              sp.id,
                            );
                          return (
                            <div
                              key={sp.id}
                              className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
                                isDisabled
                                  ? "bg-red-50/40 border-red-200"
                                  : "bg-slate-50/70 border-slate-200 hover:border-sena-green"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-sm text-slate-800">
                                    {sp.name}
                                  </span>
                                  <span
                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      isDisabled
                                        ? "bg-red-100 text-red-700"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {isDisabled ? "Deshabilitado" : "Activo"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  {sp.desc}
                                </p>

                                {["3", "4", "5"].includes(sp.id) &&
                                  (() => {
                                    const customCoord =
                                      envGlobalConfig.coordinators?.[sp.id];
                                    const defaultCoord =
                                      DEFAULT_SPACE_COORDINATORS[sp.id];
                                    const activeCoord =
                                      customCoord || defaultCoord;
                                    const isCustom = !!customCoord;

                                    return (
                                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-col gap-1.5 bg-white/80 p-2 rounded-lg">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                                            <Shield className="w-3 h-3 text-sena-green" />{" "}
                                            Coordinación
                                          </span>
                                          <span
                                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                              isCustom
                                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                                : "bg-slate-100 text-slate-600"
                                            }`}
                                          >
                                            {isCustom
                                              ? "Personalizado"
                                              : "Por Defecto"}
                                          </span>
                                        </div>

                                        <div className="text-[11px] leading-tight">
                                          <p className="font-bold text-slate-800 truncate">
                                            {activeCoord?.full_name}
                                          </p>
                                          <p className="text-[10px] text-slate-500 truncate">
                                            {activeCoord?.email}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-1.5 pt-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedSpaceForCoord({
                                                id: sp.id,
                                                name: sp.name,
                                              });
                                              setSelectedCoordUserId(
                                                customCoord?.user_id || "",
                                              );
                                              setCoordSearchQuery("");
                                              supabase.auth
                                                .getSession()
                                                .then(({ data }) => {
                                                  setIsLoadingAssignableUsers(
                                                    true,
                                                  );
                                                  getAssignableUsersAction(
                                                    data.session?.access_token,
                                                  )
                                                    .then((res) => {
                                                      if (
                                                        res?.success &&
                                                        res.users
                                                      ) {
                                                        setAssignableStaffUsers(
                                                          res.users,
                                                        );
                                                      }
                                                    })
                                                    .finally(() =>
                                                      setIsLoadingAssignableUsers(
                                                        false,
                                                      ),
                                                    );
                                                });
                                            }}
                                            className="text-[10px] font-bold text-white bg-sena-green hover:bg-emerald-700 px-2 py-1 rounded transition-colors flex-1 text-center cursor-pointer"
                                          >
                                            {isCustom ? "Cambiar" : "Asignar"}
                                          </button>
                                          {isCustom && (
                                            <button
                                              type="button"
                                              title="Restablecer coordinador por defecto"
                                              onClick={async () => {
                                                if (
                                                  !confirm(
                                                    `¿Restablecer el coordinador institucional por defecto (${defaultCoord?.full_name}) para ${sp.name}?`,
                                                  )
                                                )
                                                  return;
                                                const {
                                                  data: { session },
                                                } =
                                                  await supabase.auth.getSession();
                                                const res =
                                                  await assignSpaceCoordinatorAction(
                                                    {
                                                      spaceId: sp.id,
                                                      userId: null,
                                                      accessToken:
                                                        session?.access_token,
                                                    },
                                                  );
                                                if (res.error) {
                                                  toast.error(res.error);
                                                  return;
                                                }
                                                if (res.config) {
                                                  setEnvGlobalConfig(
                                                    res.config,
                                                  );
                                                  toast.success(
                                                    `Coordinador de ${sp.name} restablecido a ${defaultCoord?.full_name}.`,
                                                  );
                                                }
                                              }}
                                              className="text-[10px] font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2 py-1 rounded transition-colors cursor-pointer"
                                            >
                                              Restablecer
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                                <span className="text-[11px] font-bold text-slate-600">
                                  {isDisabled ? "Inactivo" : "Habilitado"}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const {
                                      data: { session },
                                    } = await supabase.auth.getSession();
                                    const res =
                                      await toggleSpaceStatusBySuperAdminAction(
                                        {
                                          specialSpaceId: sp.id,
                                          enabled: isDisabled,
                                          accessToken: session?.access_token,
                                        },
                                      );
                                    if (res.error) {
                                      toast.error(res.error);
                                      return;
                                    }
                                    if (res.config) {
                                      setEnvGlobalConfig(res.config);
                                      toast.success(
                                        isDisabled
                                          ? `${sp.name} HABILITADO para reservas.`
                                          : `${sp.name} DESHABILITADO.`,
                                      );
                                    }
                                  }}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                    !isDisabled
                                      ? "bg-sena-green"
                                      : "bg-gray-300"
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      !isDisabled
                                        ? "translate-x-5"
                                        : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Orden fijo de pestañas de ambientes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Orden Fijo de Pestañas en Calendario de Ambientes
                        </h4>
                        {envGlobalConfig.updated_by && (
                          <span className="text-[11px] text-slate-400">
                            Última modificación por:{" "}
                            <strong>{envGlobalConfig.updated_by}</strong>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Puedes reordenar las pestañas desde aquí o directamente
                        en el botón{" "}
                        <strong>&quot;Ordenar y Fijar Pestañas&quot;</strong>{" "}
                        dentro de Gestión de Ambientes.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {configData.areas
                          .filter(
                            (a) =>
                              (a.name.toUpperCase().includes("AMBIENTE") ||
                                a.name.toUpperCase().includes("AUDITORIO") ||
                                a.name.toUpperCase().includes("SUBDIRECCIÓN") ||
                                a.name.toUpperCase().includes("BIBLIOTECA") ||
                                a.name.toUpperCase().includes("COCINA")) &&
                              !a.name.toUpperCase().includes("KIOSKO") &&
                              !a.name
                                .toUpperCase()
                                .includes("AMBIENTE DE INSTRUCTORES"),
                          )
                          .sort((a, b) => {
                            const idxA = envGlobalConfig.tab_order.indexOf(
                              a.id,
                            );
                            const idxB = envGlobalConfig.tab_order.indexOf(
                              b.id,
                            );
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                            return a.name.localeCompare(b.name);
                          })
                          .map((area, index, arr) => {
                            const isAreaDisabled =
                              envGlobalConfig.disabled_area_ids.includes(
                                area.id,
                              );
                            return (
                              <div
                                key={area.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                                  isAreaDisabled
                                    ? "bg-red-50 border-red-200 text-red-600 line-through"
                                    : "bg-slate-50 border-slate-200 text-slate-700"
                                }`}
                              >
                                <span className="w-5 h-5 rounded-md bg-sena-blue text-white text-[10px] flex items-center justify-center">
                                  {index + 1}
                                </span>
                                <span>{area.name}</span>
                                <div className="flex items-center gap-1 ml-1">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={async () => {
                                      const {
                                        data: { session },
                                      } = await supabase.auth.getSession();
                                      const ids = arr.map((x) => x.id);
                                      const [moved] = ids.splice(index, 1);
                                      ids.splice(index - 1, 0, moved);
                                      const res =
                                        await saveEnvironmentsTabOrderAction(
                                          ids,
                                          session?.access_token,
                                        );
                                      if (res.config) {
                                        setEnvGlobalConfig(res.config);
                                        toast.success("Orden actualizado.");
                                      }
                                    }}
                                    className="px-1.5 py-0.5 bg-white border rounded hover:bg-sena-blue hover:text-white disabled:opacity-30 cursor-pointer"
                                    title="Mover a la izquierda"
                                  >
                                    ←
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === arr.length - 1}
                                    onClick={async () => {
                                      const {
                                        data: { session },
                                      } = await supabase.auth.getSession();
                                      const ids = arr.map((x) => x.id);
                                      const [moved] = ids.splice(index, 1);
                                      ids.splice(index + 1, 0, moved);
                                      const res =
                                        await saveEnvironmentsTabOrderAction(
                                          ids,
                                          session?.access_token,
                                        );
                                      if (res.config) {
                                        setEnvGlobalConfig(res.config);
                                        toast.success("Orden actualizado.");
                                      }
                                    }}
                                    className="px-1.5 py-0.5 bg-white border rounded hover:bg-sena-blue hover:text-white disabled:opacity-30 cursor-pointer"
                                    title="Mover a la derecha"
                                  >
                                    →
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* REMODELACIÓN / MANTENIMIENTO MULTI-AMBIENTE */}
              <div
                id="maintenance-config-card"
                className="bg-white p-6 rounded-xl shadow-sm border border-amber-200 md:col-span-2 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">
                        Pausa de Reservas / Remodelación de Ambientes
                      </h3>
                      <p className="text-xs text-gray-500">
                        Selecciona el ambiente o auditorio a pausar por obras o
                        mantenimiento. Puedes gestionar varios espacios
                        simultáneamente y habilitarlos de inmediato.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingMaintenance}
                    onClick={async () => {
                      setIsSavingMaintenance(true);
                      try {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();
                        const selectedSpaceObj =
                          availableMaintenanceSpaces.all.find(
                            (s) => s.id === maintenanceConfig.space_id,
                          );
                        const spaceName =
                          maintenanceConfig.space_name ||
                          selectedSpaceObj?.name ||
                          "Auditorio 103";

                        if (maintenanceConfig.is_active) {
                          const res = await disableSpaceMaintenanceAction({
                            spaceId: maintenanceConfig.space_id,
                            spaceName,
                            accessToken: session?.access_token,
                          });
                          if (res?.error) {
                            toast.error(res.error);
                            return;
                          }
                          if (res?.config) setMaintenanceConfig(res.config);
                          if (res?.configs)
                            setSpacesMaintenanceMap(res.configs);
                          toast.success(
                            `¡${spaceName} HABILITADO de inmediato! Se envió notificación a los usuarios.`,
                          );
                        } else {
                          const updated: SpaceMaintenanceConfig = {
                            ...maintenanceConfig,
                            space_name: spaceName,
                            is_active: true,
                          };
                          const res = await saveSpaceMaintenanceAction({
                            ...updated,
                            accessToken: session?.access_token,
                          });
                          if (res?.error) {
                            toast.error(res.error);
                            return;
                          }
                          if (res?.config) setMaintenanceConfig(res.config);
                          if (res?.configs)
                            setSpacesMaintenanceMap(res.configs);
                          if (res.cancelledCount && res.cancelledCount > 0) {
                            toast.warning(
                              `Pausa ACTIVADA para ${spaceName}. Se cancelaron ${res.cancelledCount} reserva(s) y se notificó a ${res.usersNotified} usuario(s) por correo consolidado.`,
                              { duration: 8000 },
                            );
                          } else {
                            toast.success(
                              `Bloqueo por remodelación/pausa ACTIVADO en ${spaceName} (sin reservas previas por cancelar).`,
                            );
                          }
                        }
                      } catch (err: unknown) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Error al guardar",
                        );
                      } finally {
                        setIsSavingMaintenance(false);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
                      maintenanceConfig.is_active
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-amber-600 hover:bg-amber-700 text-white"
                    }`}
                  >
                    {maintenanceConfig.is_active
                      ? "DESACTIVAR PAUSA Y HABILITAR"
                      : "ACTIVAR PAUSA"}
                  </button>
                </div>

                {/* FORMULARIO POR AMBIENTE */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Ambiente o Auditorio *
                    </label>
                    <select
                      value={maintenanceConfig.space_id}
                      onChange={(e) => {
                        const newId = e.target.value;
                        const foundSpace = availableMaintenanceSpaces.all.find(
                          (s) => s.id === newId,
                        );
                        const existingCfg = spacesMaintenanceMap[newId];
                        if (existingCfg) {
                          setMaintenanceConfig({
                            ...existingCfg,
                            space_name:
                              existingCfg.space_name ||
                              foundSpace?.name ||
                              "Espacio Institucional",
                          });
                        } else {
                          const sName =
                            foundSpace?.name || "Espacio Institucional";
                          setMaintenanceConfig({
                            is_active: false,
                            space_id: newId,
                            space_name: sName,
                            start_date:
                              maintenanceConfig.start_date ||
                              new Date().toISOString().split("T")[0],
                            end_date: null,
                            custom_title: `${sName} en Remodelación`,
                            custom_message: "",
                          });
                        }
                      }}
                      className="border border-slate-300 p-2.5 rounded-lg w-full text-sm font-semibold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <optgroup label="Espacios de Reserva Institucional">
                        {availableMaintenanceSpaces.special.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name}
                            {spacesMaintenanceMap[sp.id]?.is_active
                              ? " (PAUSADO)"
                              : ""}
                          </option>
                        ))}
                      </optgroup>
                      {availableMaintenanceSpaces.extraAreas.length > 0 && (
                        <optgroup label="Otros Ambientes de Formación">
                          {availableMaintenanceSpaces.extraAreas.map((ar) => (
                            <option key={ar.id} value={ar.id}>
                              {ar.name}
                              {spacesMaintenanceMap[ar.id]?.is_active
                                ? " (PAUSADO)"
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Fecha de Inicio de Obras / Pausa *
                    </label>
                    <input
                      type="date"
                      value={maintenanceConfig.start_date}
                      onChange={(e) =>
                        setMaintenanceConfig({
                          ...maintenanceConfig,
                          start_date: e.target.value,
                        })
                      }
                      className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Fecha Estimada de Fin (Opcional)
                    </label>
                    <input
                      type="date"
                      value={maintenanceConfig.end_date || ""}
                      onChange={(e) =>
                        setMaintenanceConfig({
                          ...maintenanceConfig,
                          end_date: e.target.value || null,
                        })
                      }
                      className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {maintenanceConfig.end_date
                        ? "Indica fecha estimada de reapertura."
                        : "Sin fecha: Bloqueará por el resto de la vigencia 2026."}
                    </span>
                  </div>

                  <div className="md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Título / Motivo del Aviso (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Obras de adecuación eléctrica y pintura"
                        value={maintenanceConfig.custom_title || ""}
                        onChange={(e) =>
                          setMaintenanceConfig({
                            ...maintenanceConfig,
                            custom_title: e.target.value,
                          })
                        }
                        className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Detalle o Instrucción para Usuarios (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Eventos reprogramados comunicarse con Coordinación"
                        value={maintenanceConfig.custom_message || ""}
                        onChange={(e) =>
                          setMaintenanceConfig({
                            ...maintenanceConfig,
                            custom_message: e.target.value,
                          })
                        }
                        className="border border-slate-300 p-2.5 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingMaintenance}
                    onClick={async () => {
                      setIsSavingMaintenance(true);
                      try {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();
                        const selectedSpaceObj =
                          availableMaintenanceSpaces.all.find(
                            (s) => s.id === maintenanceConfig.space_id,
                          );
                        const spaceName =
                          maintenanceConfig.space_name ||
                          selectedSpaceObj?.name ||
                          "Auditorio 103";

                        const res = await saveSpaceMaintenanceAction({
                          ...maintenanceConfig,
                          space_name: spaceName,
                          accessToken: session?.access_token,
                        });
                        if (res?.error) {
                          toast.error(res.error);
                          return;
                        }
                        if (res?.config) setMaintenanceConfig(res.config);
                        if (res?.configs) setSpacesMaintenanceMap(res.configs);
                        toast.success(
                          `Configuración de ${spaceName} guardada exitosamente.`,
                        );
                      } catch (err: unknown) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Error al guardar",
                        );
                      } finally {
                        setIsSavingMaintenance(false);
                      }
                    }}
                    className="bg-sena-green hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Guardar Configuración
                  </button>
                </div>

                {/* LISTADO DE AMBIENTES ACTUALMENTE PAUSADOS */}
                <div className="pt-5 border-t border-amber-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      Ambientes con Pausa o Remodelación Activa
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                        {pausedSpacesList.length}
                      </span>
                    </h4>
                  </div>

                  {pausedSpacesList.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Todos los ambientes y auditorios se encuentran habilitados
                      para reservas en este momento.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pausedSpacesList.map((entry) => {
                        const displayName =
                          entry.space_name ||
                          availableMaintenanceSpaces.all.find(
                            (s) => s.id === entry.space_id,
                          )?.name ||
                          entry.space_id;
                        return (
                          <div
                            key={entry.space_id}
                            className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-black text-slate-800">
                                  {displayName}
                                </span>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  En Pausa / Remodelación
                                </span>
                              </div>
                              <p className="text-xs text-slate-600">
                                <strong>Inicio:</strong> {entry.start_date}{" "}
                                &nbsp;|&nbsp; <strong>Fin estimado:</strong>{" "}
                                {entry.end_date || "Vigencia 2026"}
                              </p>
                              {(entry.custom_title || entry.custom_message) && (
                                <p className="text-[11px] text-amber-900 truncate">
                                  {entry.custom_title}
                                  {entry.custom_message
                                    ? ` — ${entry.custom_message}`
                                    : ""}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setMaintenanceConfig({
                                    ...entry,
                                    space_name: displayName,
                                  });
                                  document
                                    .getElementById("maintenance-config-card")
                                    ?.scrollIntoView({ behavior: "smooth" });
                                  toast.info(
                                    `Editando configuración de pausa para ${displayName}.`,
                                  );
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Modificar
                              </button>
                              <button
                                type="button"
                                disabled={isSavingMaintenance}
                                onClick={async () => {
                                  setIsSavingMaintenance(true);
                                  try {
                                    const {
                                      data: { session },
                                    } = await supabase.auth.getSession();
                                    const res =
                                      await disableSpaceMaintenanceAction({
                                        spaceId: entry.space_id,
                                        spaceName: displayName,
                                        accessToken: session?.access_token,
                                      });
                                    if (res?.error) {
                                      toast.error(res.error);
                                      return;
                                    }
                                    if (res?.configs) {
                                      setSpacesMaintenanceMap(res.configs);
                                    }
                                    if (
                                      maintenanceConfig.space_id ===
                                        entry.space_id &&
                                      res?.config
                                    ) {
                                      setMaintenanceConfig(res.config);
                                    }
                                    toast.success(
                                      `¡${displayName} habilitado de inmediato! Los usuarios han sido notificados.`,
                                      { duration: 6000 },
                                    );
                                  } finally {
                                    setIsSavingMaintenance(false);
                                  }
                                }}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                <Power className="w-3.5 h-3.5" />
                                Desactivar y Habilitar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
              onClose={() => setShowActionModal(false)}
              onSuccess={() => {
                setShowActionModal(false);
                fetchData();
              }}
            />
          </React.Suspense>
        )}

        {/* --- MODAL 5: ASIGNAR COORDINADOR DE AMBIENTE (SUPERADMIN) --- */}
        {selectedSpaceForCoord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-sena-green px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <div>
                    <h3 className="font-black text-base leading-tight">
                      Asignar Coordinador
                    </h3>
                    <p className="text-xs text-white/90">
                      {selectedSpaceForCoord.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSpaceForCoord(null)}
                  className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Privilegios y Requisitos:</p>
                    <p className="mt-0.5 text-blue-800">
                      Solo funcionarios VIP o de planta pueden ser designados.
                      Al asignar al usuario, el sistema garantizará
                      automáticamente sus credenciales VIP y reasignará las
                      solicitudes pendientes de autorización de este espacio.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Buscar Funcionario / Coordinador
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por nombre, usuario o correo..."
                      value={coordSearchQuery}
                      onChange={(e) => setCoordSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sena-green"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Seleccionar Funcionario
                  </label>
                  <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      const q = coordSearchQuery.toLowerCase().trim();
                      const filtered = coordinatorCandidateUsers.filter((u) => {
                        if (!q) return true;
                        return (
                          (u.full_name || "").toLowerCase().includes(q) ||
                          (u.username || "").toLowerCase().includes(q) ||
                          (u.email || "").toLowerCase().includes(q) ||
                          (u.area || "").toLowerCase().includes(q) ||
                          (u.job_category || "").toLowerCase().includes(q)
                        );
                      });

                      if (isLoadingAssignableUsers && filtered.length === 0) {
                        return (
                          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-sena-green" />
                            Cargando directorio de funcionarios...
                          </div>
                        );
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="p-6 text-center text-xs text-slate-500">
                            {coordSearchQuery.trim()
                              ? `No se encontraron funcionarios que coincidan con "${coordSearchQuery}".`
                              : "No hay funcionarios disponibles en el directorio."}
                          </div>
                        );
                      }

                      return filtered.map((u) => {
                        const isVipUser =
                          !!u.is_vip ||
                          u.role === "coordinator" ||
                          (u.job_category || "")
                            .toLowerCase()
                            .includes("coordinador");
                        const isPlanta = (u.employment_type || "")
                          .toLowerCase()
                          .includes("planta");
                        const isSelected = selectedCoordUserId === u.id;
                        return (
                          <div
                            key={u.id}
                            onClick={() => setSelectedCoordUserId(u.id)}
                            className={`p-3 cursor-pointer flex items-center justify-between transition-colors ${
                              isSelected
                                ? "bg-emerald-50 border-l-4 border-sena-green"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {u.full_name}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                @{u.username} ·{" "}
                                {u.email || `${u.username}@sena.edu.co`}
                              </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {isVipUser ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  VIP
                                </span>
                              ) : isPlanta ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                  Planta
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {u.role || "Funcionario"}
                                </span>
                              )}
                              <input
                                type="radio"
                                name="coordUser"
                                checked={isSelected}
                                onChange={() => setSelectedCoordUserId(u.id)}
                                className="text-sena-green focus:ring-sena-green h-4 w-4"
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSpaceForCoord(null)}
                  disabled={isAssigningCoord}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedCoordUserId || isAssigningCoord}
                  onClick={async () => {
                    if (!selectedCoordUserId) return;
                    setIsAssigningCoord(true);
                    try {
                      const {
                        data: { session },
                      } = await supabase.auth.getSession();
                      const res = await assignSpaceCoordinatorAction({
                        spaceId: selectedSpaceForCoord.id,
                        userId: selectedCoordUserId,
                        accessToken: session?.access_token,
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      if (res.config) {
                        setEnvGlobalConfig(res.config);
                        if (
                          typeof res.transferredCount === "number" &&
                          res.transferredCount > 0
                        ) {
                          toast.success(
                            `Coordinador asignado con éxito. Se trasladaron ${res.transferredCount} solicitud(es) pendiente(s) a su bandeja.`,
                          );
                        } else {
                          toast.success(
                            `Coordinador de ${selectedSpaceForCoord.name} asignado correctamente.`,
                          );
                        }
                        setSelectedSpaceForCoord(null);
                      }
                    } catch {
                      toast.error("Error al asignar coordinador");
                    } finally {
                      setIsAssigningCoord(false);
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-sena-green hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  {isAssigningCoord ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Asignando...
                    </>
                  ) : (
                    "Confirmar Asignación"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
