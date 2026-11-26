"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Monitor,
  Send,
  Calendar,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Book,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Power,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import PanicButtonModal from "./PanicButtonModal";
import LibraryApprovalModal from "@/features/reservations/components/LibraryApprovalModal";
import Ambiente107ApprovalModal from "@/features/reservations/components/Ambiente107ApprovalModal";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import UnifiedAvailabilityCalendar from "@/features/reservations/components/UnifiedAvailabilityCalendar";
import AuditoriumMaintenanceModal from "@/features/reservations/components/AuditoriumMaintenanceModal";
import {
  getBogotaDateString,
  getVisibleSpaceIdsForUser,
} from "@/features/reservations/rules/reservationRules";
import {
  getAllSpacesMaintenanceConfig,
  DEFAULT_AUDITORIUM_MAINTENANCE,
  getEnvironmentsGlobalConfig,
  DEFAULT_ENVIRONMENTS_CONFIG,
  resolveSpaceDisplayName,
} from "@/features/reservations/services/maintenanceService";
import { toggleSpaceStatusBySuperAdminAction } from "@/features/reservations/actions/reservationActions";
import {
  SpaceMaintenanceConfig,
  EnvironmentsGlobalConfig,
} from "@/features/reservations/types";
import { User } from "./types";

const SupportRedirectMessage = ({
  onClose,
  showBackButton,
}: {
  onClose?: () => void;
  showBackButton?: boolean;
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);

  const handleCopyAddresses = () => {
    navigator.clipboard.writeText(
      "To: mesadeservicio@sena.edu.co\nCC: jucsendoya@sena.edu.co, lapinilla@sena.edu.co",
    );
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto text-center animate-in zoom-in-95 duration-500">
      <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
        <Monitor className="w-10 h-10 text-sena-green" />
      </div>
      <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mb-4">
        ¡Gracias por tu confianza!
      </h3>
      <p className="text-slate-600 mb-6 text-base leading-relaxed font-medium">
        Te informamos que el sistema seguirá funcionando con normalidad para la{" "}
        <strong>reserva de Auditorio y Biblioteca</strong>.
        <br />
        <br />A partir de ahora, los casos de servicio técnico se manejarán
        directamente por correo electrónico.
      </p>

      <div className="flex flex-col gap-3 mt-6 w-full">
        {/* BOTÓN PRINCIPAL: OUTLOOK WEB */}
        <a
          href="https://outlook.office.com/owa/?path=/mail/action/compose&to=mesadeservicio@sena.edu.co&cc=jucsendoya@sena.edu.co,lapinilla@sena.edu.co&subject=Solicitud%20Soporte%20T%C3%A9cnico"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="w-full py-4 bg-sena-green hover:bg-[#2d8500] text-white rounded-xl font-bold shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-3 hover:scale-[1.02]"
        >
          <ExternalLink className="w-5 h-5" />
          Abrir en Outlook Web (Recomendado)
        </a>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=mesadeservicio@sena.edu.co&cc=jucsendoya@sena.edu.co,lapinilla@sena.edu.co&su=Solicitud%20Soporte%20T%C3%A9cnico"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="py-3 bg-white border border-slate-200 hover:border-[#EA4335] hover:bg-[#EA4335]/5 text-slate-700 hover:text-[#EA4335] rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Gmail Web
          </a>
          <a
            href="mailto:mesadeservicio@sena.edu.co?cc=jucsendoya@sena.edu.co,lapinilla@sena.edu.co"
            onClick={onClose}
            className="py-3 bg-white border border-slate-200 hover:border-sena-green hover:bg-green-50 text-slate-700 hover:text-sena-green rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Send className="w-4 h-4" />
            Correo (App)
          </a>
        </div>

        <button
          onClick={handleCopyAddresses}
          className="w-full mt-1 py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
        >
          {copiedAddress ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-600">¡Correos copiados!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copiar direcciones de correo
            </>
          )}
        </button>

        {showBackButton && onClose && (
          <button
            onClick={onClose}
            className="w-full mt-1 py-3 bg-transparent hover:bg-slate-100 text-slate-500 rounded-xl font-bold transition-colors text-sm"
          >
            Volver al menú
          </button>
        )}
      </div>
    </div>
  );
};

export default function UserRequestForm({
  user,
  onCancel,
  onViewChange,
  currentView,
}: {
  user: User;
  onCancel: () => void;
  onViewChange?: (
    view: "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY",
  ) => void;
  currentView?: "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY";
}) {
  // User Request Request Hook logic is removed as Ticket feature is disabled

  // VISTA ACTUAL: 'SELECTION' | 'TICKET' | 'RESERVATION' | 'AVAILABILITY'
  const [view, setView] = useState<
    "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY"
  >(currentView || "SELECTION");

  // Sincronizar con la prop currentView
  useEffect(() => {
    if (!currentView || currentView === view) return;
    const t = setTimeout(() => {
      setView(currentView);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const handleViewChange = (
    newView: "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY",
  ) => {
    if (onViewChange) {
      onViewChange(newView);
    }
    if (!onViewChange) {
      setView(newView);
    }
  };

  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showSupportRedirect, setShowSupportRedirect] = useState(false);
  const [selectedReservationSpace, setSelectedReservationSpace] = useState<
    "1" | "2" | "3" | "4" | "5"
  >("1");
  const [calendarInitialSpace, setCalendarInitialSpace] = useState<
    "ALL" | "1" | "2" | "3" | "4" | "5"
  >("ALL");
  const [reservationPrefill, setReservationPrefill] = useState<{
    date: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(() => {
    const bogotaHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
    const nextHour = bogotaHour >= 7 && bogotaHour < 21 ? bogotaHour + 1 : 7;
    const endHour = Math.min(22, nextHour + 1);
    return {
      spaceId: "1",
      date: getBogotaDateString(),
      startTime: `${String(nextHour).padStart(2, "0")}:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
    };
  });

  const handleFormSelectionChange = useCallback(
    (sel: {
      spaceId: string;
      date: string;
      startTime: string;
      endTime: string;
    }) => {
      setSelectedReservationSpace(sel.spaceId as "1" | "2" | "3" | "4" | "5");
      setSelectedSlot((prev) =>
        prev.spaceId === sel.spaceId &&
        prev.date === sel.date &&
        prev.startTime === sel.startTime &&
        prev.endTime === sel.endTime
          ? prev
          : sel,
      );
    },
    [],
  );

  interface TodayReservation {
    id: number;
    start_time: string;
    end_time: string;
    title: string;
    auditorium_id: string | number;
    users: {
      full_name: string;
    } | null;
  }

  const [todayReservations, setTodayReservations] = useState<
    TodayReservation[]
  >([]);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const fetchTodayReservations = async () => {
      try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const { data } = await supabase
          .from("reservations")
          .select("*, users(full_name)")
          .eq("status", "APPROVED")
          .gte("start_time", yesterday.toISOString())
          .lte("start_time", tomorrow.toISOString())
          .order("start_time", { ascending: true });

        if (data) {
          const todayStr = now.toLocaleDateString("en-US", {
            timeZone: "America/Bogota",
          });
          const typedData = data as unknown as TodayReservation[];
          const filtered = typedData.filter((res) => {
            const resDateStr = new Date(res.start_time).toLocaleDateString(
              "en-US",
              { timeZone: "America/Bogota" },
            );
            return resDateStr === todayStr;
          });
          setTodayReservations(filtered);
        }
      } catch (e) {
        console.error("Error fetching today's reservations:", e);
      } finally {
        setLoadingReservations(false);
      }
    };

    fetchTodayReservations();
  }, []);

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [spacesMaintenance, setSpacesMaintenance] = useState<
    Record<string, SpaceMaintenanceConfig>
  >({});
  const [activeModalConfig, setActiveModalConfig] =
    useState<SpaceMaintenanceConfig>(DEFAULT_AUDITORIUM_MAINTENANCE);
  const [recentlyReopenedSpaces, setRecentlyReopenedSpaces] = useState<
    SpaceMaintenanceConfig[]
  >([]);
  const [dismissedReopenedBanner, setDismissedReopenedBanner] = useState(false);
  const [envGlobalConfig, setEnvGlobalConfig] =
    useState<EnvironmentsGlobalConfig>(DEFAULT_ENVIRONMENTS_CONFIG);

  useEffect(() => {
    getAllSpacesMaintenanceConfig()
      .then((cfgs) => {
        const safeCfgs = cfgs || {};
        setSpacesMaintenance(safeCfgs);
        const nowMs = Date.now();
        const reopened = Object.values(safeCfgs).filter((cfg) => {
          if (cfg.is_active || !cfg.reactivated_at) return false;
          const diffHours =
            (nowMs - new Date(cfg.reactivated_at).getTime()) / (1000 * 60 * 60);
          return diffHours >= 0 && diffHours <= 48;
        });
        setRecentlyReopenedSpaces(reopened);
      })
      .catch(() => {});
    getEnvironmentsGlobalConfig()
      .then((cfg) => {
        setEnvGlobalConfig(cfg);
      })
      .catch(() => {});
  }, []);

  const isSuperAdmin =
    ((user?.role as string) || "").toLowerCase() === "superadmin";

  const handleToggleSpecialSpace = async (
    e: React.MouseEvent,
    spaceId: string,
    spaceName: string,
    currentlyDisabled: boolean,
  ) => {
    e.stopPropagation();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await toggleSpaceStatusBySuperAdminAction({
        specialSpaceId: spaceId,
        enabled: currentlyDisabled,
        accessToken: session?.access_token,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.config) {
        setEnvGlobalConfig(res.config);
        toast.success(
          currentlyDisabled
            ? `${spaceName} HABILITADO.`
            : `${spaceName} DESHABILITADO.`,
        );
      }
    } catch {
      toast.error(
        "No se pudo cambiar el estado del espacio. Verifica tu sesión.",
      );
    }
  };

  const isAdmin = ["admin", "superadmin", "vip"].includes(
    ((user?.role as string) || "").toLowerCase(),
  );
  const isVip =
    !!(user as never as { is_vip?: boolean })?.is_vip ||
    ((user?.role as string) || "").toLowerCase() === "vip";
  const canSeeSubdireccion =
    isVip ||
    isAdmin ||
    ((user?.email as string) || "").toLowerCase() ===
      "emgutierrezn@sena.edu.co";

  const userEmail = ((user?.email as string) || "").toLowerCase();
  const usernameStr = ((user?.username as string) || "").toLowerCase();
  const roleStr = ((user?.role as string) || "").toLowerCase();
  const jobCatStr = (
    (user as never as { job_category?: string })?.job_category || ""
  ).toLowerCase();
  const areaStr = (
    (user as never as { area?: string })?.area || ""
  ).toLowerCase();
  const empTypeStr = (
    (user as never as { employment_type?: string })?.employment_type || ""
  ).toLowerCase();

  const isCoordinator =
    jobCatStr.includes("coordinador") ||
    roleStr.includes("coordinator") ||
    !!user?.perm_manage_assignments ||
    ["nbarrerac", "egutierrezn", "emgutierrezn"].includes(usernameStr);

  const isInstructor =
    jobCatStr.includes("instructor") ||
    roleStr.includes("instructor") ||
    areaStr.includes("instructor") ||
    empTypeStr.includes("instructor");

  const isPlanta = empTypeStr.includes("planta");
  const canSeeBiblioteca =
    [
      "egutierrezn@sistema.local",
      "rbiblioteca@sistema.local",
      "emgutierrezn@sena.edu.co",
    ].includes(userEmail) ||
    ["egutierrezn", "rbiblioteca", "emgutierrezn"].includes(usernameStr) ||
    isAdmin ||
    isCoordinator ||
    isInstructor ||
    isPlanta ||
    isVip;

  const canSeeAmbiente107 =
    ["nbarrerac@sena.edu.co", "dasanchezh@sena.edu.co"].some((mail) =>
      userEmail.includes(mail.toLowerCase()),
    ) ||
    ["nbarrerac", "dasanchezh"].includes(usernameStr) ||
    isAdmin ||
    isCoordinator ||
    isInstructor ||
    isPlanta ||
    isVip;

  // --- VISTA DE SELECCIÓN (BENTO ASIMÉTRICO 12 COLUMNAS - IMPECCABLE DESIGN POLISH) ---
  if (view === "SELECTION") {
    const isSpaceDisabled = (id: string) =>
      envGlobalConfig.disabled_special_spaces.includes(id);

    const isSpacePaused = (id: string) =>
      Boolean(spacesMaintenance[id]?.is_active);

    const visibleIds = getVisibleSpaceIdsForUser(
      user as unknown as {
        role?: string;
        employment_type?: string;
        job_category?: string;
        is_vip?: boolean;
        perm_manage_assignments?: boolean;
      },
    );

    const handleSpaceSelection = (
      id: "1" | "2" | "3" | "4" | "5",
      label: string,
    ) => {
      if (isSpaceDisabled(id)) {
        toast.error(
          `${label} se encuentra deshabilitado temporalmente. No es posible realizar reservas hasta que sea habilitado de nuevo.`,
        );
        return;
      }
      if (isSpacePaused(id)) {
        setActiveModalConfig(
          spacesMaintenance[id] || {
            ...DEFAULT_AUDITORIUM_MAINTENANCE,
            space_id: id,
            space_name: label,
          },
        );
        setShowMaintenanceModal(true);
        return;
      }
      setReservationPrefill(null);
      setSelectedReservationSpace(id);
      setCalendarInitialSpace(id);
      setSelectedSlot((prev) => ({ ...prev, spaceId: id }));
      handleViewChange("AVAILABILITY");
    };

    const spaceCards = [
      {
        id: "1" as const,
        visible:
          visibleIds.includes("1") && (isSuperAdmin || !isSpaceDisabled("1")),
        disabled: isSpaceDisabled("1"),
        title: "Auditorio 103",
        subtitle: "Capacitaciones institucionales y eventos masivos.",
        badge: isSpacePaused("1") ? "En Remodelación" : "Uso General",
        badgeClass: isSpacePaused("1")
          ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
          : "bg-sena-blue/10 text-sena-blue",
        iconBg:
          "bg-sena-blue/10 text-sena-blue group-hover:bg-sena-blue group-hover:text-white",
        borderHover: "hover:border-sena-blue",
        accentBar: "bg-sena-blue",
        icon: Calendar,
        onClick: () => handleSpaceSelection("1", "Auditorio 103"),
      },
      {
        id: "2" as const,
        visible:
          visibleIds.includes("2") &&
          canSeeSubdireccion &&
          (isSuperAdmin || !isSpaceDisabled("2")),
        disabled: isSpaceDisabled("2"),
        title: "Subdirección",
        subtitle: "Reuniones ejecutivas y de alta gerencia.",
        badge: isSpacePaused("2") ? "En Remodelación" : "Disponible",
        badgeClass: isSpacePaused("2")
          ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
          : "bg-orange-100 text-sena-orange",
        iconBg:
          "bg-orange-50 text-sena-orange group-hover:bg-sena-orange group-hover:text-white",
        borderHover: "hover:border-sena-orange",
        accentBar: "bg-sena-orange",
        icon: Calendar,
        onClick: () => handleSpaceSelection("2", "Subdirección"),
      },
      {
        id: "3" as const,
        visible:
          visibleIds.includes("3") &&
          canSeeBiblioteca &&
          (isSuperAdmin || !isSpaceDisabled("3")),
        disabled: isSpaceDisabled("3"),
        title: "Biblioteca",
        subtitle: "Entornos de consulta, lectura y aprendizaje.",
        badge: isSpacePaused("3") ? "En Remodelación" : "Académico",
        badgeClass: isSpacePaused("3")
          ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
          : "bg-sena-blue/10 text-sena-blue",
        iconBg:
          "bg-sena-blue/10 text-sena-blue group-hover:bg-sena-blue group-hover:text-white",
        borderHover: "hover:border-sena-blue",
        accentBar: "bg-sena-blue",
        icon: Book,
        onClick: () => handleSpaceSelection("3", "Biblioteca"),
      },
      {
        id: "4" as const,
        visible:
          visibleIds.includes("4") &&
          canSeeAmbiente107 &&
          (isSuperAdmin || !isSpaceDisabled("4")),
        disabled: isSpaceDisabled("4"),
        title: "Ambiente 107",
        subtitle: "Formación y sesiones técnicas especializadas.",
        badge: isSpacePaused("4") ? "En Remodelación" : "Prerreserva",
        badgeClass: isSpacePaused("4")
          ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
          : "bg-emerald-100 text-emerald-800",
        iconBg:
          "bg-emerald-50 text-sena-green group-hover:bg-sena-green group-hover:text-white",
        borderHover: "hover:border-sena-green",
        accentBar: "bg-sena-green",
        icon: Calendar,
        onClick: () => handleSpaceSelection("4", "Ambiente 107"),
      },
      {
        id: "5" as const,
        visible:
          visibleIds.includes("5") &&
          canSeeAmbiente107 &&
          (isSuperAdmin || !isSpaceDisabled("5")),
        disabled: isSpaceDisabled("5"),
        title: "Ambiente de Cocina",
        subtitle: "Talleres gastronómicos y formación en cocina.",
        badge: isSpacePaused("5") ? "En Remodelación" : "Prerreserva",
        badgeClass: isSpacePaused("5")
          ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
          : "bg-amber-100 text-amber-800",
        iconBg:
          "bg-amber-50 text-amber-600 group-hover:bg-sena-orange group-hover:text-white",
        borderHover: "hover:border-sena-orange",
        accentBar: "bg-sena-orange",
        icon: Calendar,
        onClick: () => handleSpaceSelection("5", "Ambiente de Cocina"),
      },
    ].filter((c) => c.visible);

    return (
      <div className="swiss-view-enter w-full max-w-[1600px] mx-auto px-2 sm:px-3 py-1 flex-1 flex flex-col">
        {/* ENCABEZADO COMPACTO CALIBRADO PARA FULL HD 1080P */}
        <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sena-green/10 text-sena-green text-[11px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-sena-green animate-ping" />
                Portal Institucional de Espacios y Ambientes
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">•</span>
              <span className="text-xs text-slate-500 font-medium">
                Gestiona tus reservas y consulta disponibilidad en tiempo real
              </span>
            </div>
            <h2 className="text-2xl lg:text-[26px] font-black text-sena-blue tracking-tight leading-tight mt-1">
              ¿En qué podemos{" "}
              <span className="text-sena-green">ayudarte hoy?</span>
            </h2>
          </div>

          <button
            onClick={onCancel}
            className="group self-start md:self-auto px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-sena-blue hover:text-sena-blue transition-all text-xs font-black flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            FINALIZAR SESIÓN
          </button>
        </div>

        {/* AVISO INMEDIATO DE AMBIENTES REHABILITADOS */}
        {!dismissedReopenedBanner && recentlyReopenedSpaces.length > 0 && (
          <div className="mb-3.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                  ¡Ambiente(s) Habilitado(s) para Reservas!
                </p>
                <p className="text-xs text-emerald-800 font-medium mt-0.5">
                  Ya se encuentra habilitado{" "}
                  <strong>
                    {recentlyReopenedSpaces
                      .map((s) => s.space_name || "Espacio Institucional")
                      .join(", ")}
                  </strong>{" "}
                  para programar tus eventos y actividades con normalidad.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedReopenedBanner(true)}
              className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-100 rounded-lg shrink-0 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        )}

        {/* GRID DE 3 COLUMNAS EQUILIBRADAS (APROVECHANDO ESPACIO VERTICAL COMPLETO) */}
        <div className="@container grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch flex-1">
          {/* COLUMNA 1: AGENDA / EVENTOS DE HOY (ORDEN CRONOLÓGICO CONSERVADO) */}
          <div className="flex flex-col gap-3 h-full bg-slate-50/70 rounded-3xl p-4 lg:p-5 border border-slate-200/70 shadow-xs">
            {(() => {
              const activeCount = todayReservations.filter(
                (r) => new Date(r.end_time).getTime() > nowMs,
              ).length;
              const finishedCount = todayReservations.length - activeCount;
              return (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-sena-green rounded-full" />
                    <h4 className="text-xs font-black uppercase tracking-[0.16em] text-sena-blue flex items-center gap-1.5">
                      Eventos de Hoy
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-mono text-[10.5px] font-bold bg-sena-green/15 text-sena-green px-2 py-0.5 rounded-full">
                      {activeCount} vigentes
                    </span>
                    {finishedCount > 0 && (
                      <span className="tabular-mono text-[10px] font-semibold bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full">
                        {finishedCount} cumplidos
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[430px] scrollbar-thin scrollbar-thumb-gray-200 min-h-[290px]">
              {loadingReservations ? (
                <div className="space-y-2.5 py-1">
                  <div className="h-16 rounded-xl skeleton-shimmer" />
                  <div className="h-16 rounded-xl skeleton-shimmer" />
                  <div className="h-16 rounded-xl skeleton-shimmer" />
                </div>
              ) : todayReservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 text-center h-full">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-1">
                    <Clock className="w-5 h-5 text-slate-300" />
                  </div>
                  <span className="text-xs font-black text-slate-700">
                    Sin reservas hoy
                  </span>
                  <span className="text-[11px] text-slate-400 max-w-[200px]">
                    No se han registrado eventos programados para el día de hoy.
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[...todayReservations]
                    .sort(
                      (a, b) =>
                        new Date(a.start_time).getTime() -
                        new Date(b.start_time).getTime(),
                    )
                    .map((res) => {
                      const start = new Date(res.start_time);
                      const end = new Date(res.end_time);
                      const startMs = start.getTime();
                      const endMs = end.getTime();

                      const isFinished = nowMs >= endMs;
                      const isInProgress = nowMs >= startMs && nowMs < endMs;

                      const totalDurationMs = Math.max(1, endMs - startMs);
                      const progressPct = isFinished
                        ? 100
                        : isInProgress
                          ? Math.min(
                              100,
                              Math.max(
                                6,
                                Math.round(
                                  ((nowMs - startMs) / totalDurationMs) * 100,
                                ),
                              ),
                            )
                          : 0;

                      const formatDuration = (diffMs: number) => {
                        const totalMins = Math.max(
                          1,
                          Math.ceil(diffMs / 60000),
                        );
                        const h = Math.floor(totalMins / 60);
                        const m = totalMins % 60;
                        if (h > 0 && m > 0) return `${h}h ${m}m`;
                        if (h > 0) return `${h}h`;
                        return `${m} min`;
                      };

                      const startHourBogota = Number(
                        start.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          hour12: false,
                          timeZone: "America/Bogota",
                        }),
                      );
                      const shiftLabel =
                        startHourBogota < 12
                          ? "Jornada Mañana"
                          : startHourBogota < 18
                            ? "Jornada Tarde"
                            : "Jornada Noche";

                      const formatTime = (d: Date) =>
                        d.toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "America/Bogota",
                        });

                      const spaceIdStr = String(res.auditorium_id);
                      const spaceTheme =
                        spaceIdStr === "5"
                          ? {
                              label: "Cocina",
                              cardActive:
                                "bg-orange-50/70 border-orange-200 border-l-[#FC7323]",
                              badge:
                                "bg-[#FC7323] text-white border border-orange-600",
                              barColor: "bg-[#FC7323]",
                              Icon: CalendarRange,
                            }
                          : spaceIdStr === "4"
                            ? {
                                label: "Ambiente 107",
                                cardActive:
                                  "bg-emerald-50/70 border-emerald-200 border-l-[#39A900]",
                                badge:
                                  "bg-[#39A900] text-white border border-emerald-700",
                                barColor: "bg-[#39A900]",
                                Icon: Monitor,
                              }
                            : spaceIdStr === "3"
                              ? {
                                  label: "Biblioteca",
                                  cardActive:
                                    "bg-teal-50/70 border-teal-200 border-l-teal-700",
                                  badge:
                                    "bg-teal-700 text-white border border-teal-800",
                                  barColor: "bg-teal-600",
                                  Icon: Book,
                                }
                              : spaceIdStr === "2"
                                ? {
                                    label: "Subdirección",
                                    cardActive:
                                      "bg-indigo-50/70 border-indigo-200 border-l-indigo-800",
                                    badge:
                                      "bg-indigo-800 text-white border border-indigo-900",
                                    barColor: "bg-indigo-700",
                                    Icon: Monitor,
                                  }
                                : {
                                    label: "Auditorio 103",
                                    cardActive:
                                      "bg-blue-50/70 border-blue-200 border-l-[#043263]",
                                    badge:
                                      "bg-[#043263] text-white border border-blue-950",
                                    barColor: "bg-[#043263]",
                                    Icon: Calendar,
                                  };

                      const SpaceIcon = spaceTheme.Icon;

                      return (
                        <div
                          key={res.id}
                          className={`p-3 rounded-xl border border-l-4 transition-all flex flex-col gap-1.5 ${
                            isFinished
                              ? "bg-slate-50/90 border-slate-200 border-l-slate-400 opacity-65"
                              : isInProgress
                                ? `${spaceTheme.cardActive} shadow-sm ring-1 ring-[#39A900]/25`
                                : spaceTheme.cardActive
                          }`}
                        >
                          {/* Fila 1: Ambiente + Estado temporal dinámico */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                                isFinished
                                  ? "bg-slate-200 text-slate-600"
                                  : spaceTheme.badge
                              }`}
                            >
                              <SpaceIcon className="w-3 h-3" />
                              {spaceTheme.label}
                            </span>

                            {isFinished ? (
                              <span className="tabular-mono text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-slate-500" />
                                FINALIZADO
                              </span>
                            ) : isInProgress ? (
                              <span className="tabular-mono text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#39A900] animate-ping" />
                                EN CURSO · Resta {formatDuration(endMs - nowMs)}
                              </span>
                            ) : (
                              <span className="tabular-mono text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-slate-700 border border-slate-200">
                                {shiftLabel} · En{" "}
                                {formatDuration(startMs - nowMs)}
                              </span>
                            )}
                          </div>

                          {/* Fila 2: Título de la actividad */}
                          <div className="flex justify-between items-start gap-2">
                            <span
                              className={`font-bold text-xs leading-snug line-clamp-1 ${
                                isFinished
                                  ? "line-through decoration-slate-400 text-slate-500"
                                  : "text-slate-800"
                              }`}
                            >
                              {res.title}
                            </span>
                          </div>

                          {/* Fila 3: Horario + Responsable */}
                          <div className="flex items-center justify-between gap-2 text-[10.5px]">
                            <div className="tabular-mono flex items-center gap-1 font-semibold text-slate-600">
                              <Clock
                                className={`w-3 h-3 ${
                                  isFinished
                                    ? "text-slate-400"
                                    : "text-sena-green"
                                }`}
                              />
                              <span>{`${formatTime(start)} - ${formatTime(end)}`}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                              {res.users?.full_name || "Funcionario"}
                            </span>
                          </div>

                          {/* Barra de progreso temporal (visible cuando está en curso o finalizado) */}
                          {(isInProgress || isFinished) && (
                            <div className="w-full h-1 bg-slate-200/80 rounded-full overflow-hidden mt-0.5">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isFinished
                                    ? "bg-slate-400"
                                    : spaceTheme.barColor
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA 2: RESERVAS & ESPACIOS (TARJETAS VERTICALES CALIBRADAS PARA FULL HD 1080P) */}
          <div className="flex flex-col gap-3.5 h-full bg-slate-50/70 rounded-3xl p-4 lg:p-5 border border-slate-200/70 shadow-xs">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-sena-blue rounded-full" />
                <h4 className="text-xs font-black uppercase tracking-[0.16em] text-sena-blue">
                  Reservas &amp; Espacios
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                Selecciona un espacio
              </span>
            </div>

            <div className="flex flex-col gap-2.5 flex-1 justify-between">
              {spaceCards.map((sp) => {
                const IconComponent = sp.icon;

                return (
                  <div
                    key={sp.id}
                    onClick={sp.onClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        sp.onClick();
                      }
                    }}
                    className={`group relative bg-white rounded-2xl p-3.5 border-2 border-slate-100 ${sp.borderHover} shadow-2xs hover:shadow-md transition-all duration-300 text-left flex items-center gap-3.5 cursor-pointer flex-1 ${
                      sp.disabled
                        ? "opacity-65 bg-red-50/30 border-red-200"
                        : ""
                    }`}
                  >
                    {/* Icono proporcional Full HD */}
                    <div
                      className={`p-3 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 ${sp.iconBg}`}
                    >
                      <IconComponent className="w-6 h-6" />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h3 className="text-base font-black text-slate-800 group-hover:text-sena-blue transition-colors truncate">
                          {sp.title}
                        </h3>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                            sp.disabled
                              ? "bg-red-100 text-red-700"
                              : sp.badgeClass
                          }`}
                        >
                          {sp.disabled ? "Deshabilitado" : sp.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium italic opacity-85 group-hover:opacity-100 leading-snug line-clamp-1">
                        {sp.subtitle}
                      </p>
                    </div>

                    {/* Toggle exclusivo de SuperAdmin directo en la card o flecha */}
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        onClick={(e) =>
                          handleToggleSpecialSpace(
                            e,
                            sp.id,
                            sp.title,
                            sp.disabled,
                          )
                        }
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer ${
                          sp.disabled
                            ? "bg-red-600 text-white border-red-600 hover:bg-emerald-600"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600"
                        }`}
                        title={
                          sp.disabled
                            ? "SuperAdmin: Clic para Habilitar espacio"
                            : "SuperAdmin: Clic para Deshabilitar espacio"
                        }
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sena-green group-hover:translate-x-1 transition-all shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 3: SERVICIOS & CONSULTA DE DISPONIBILIDAD (CALIBRADA FULL HD 1080P) */}
          <div className="flex flex-col gap-3.5 h-full bg-slate-50/70 rounded-3xl p-4 lg:p-5 border border-slate-200/70 shadow-xs">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-sena-orange rounded-full" />
                <h4 className="text-xs font-black uppercase tracking-[0.16em] text-sena-blue">
                  Servicios &amp; Consulta
                </h4>
              </div>
              <span className="text-[10px] font-black uppercase text-sena-green bg-sena-green/10 px-2 py-0.5 rounded-full">
                En Vivo
              </span>
            </div>

            <button
              onClick={() => {
                setCalendarInitialSpace("ALL");
                handleViewChange("AVAILABILITY");
              }}
              className="group relative flex-1 bg-gradient-to-br from-sena-blue via-[#053b75] to-[#032244] p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center justify-between overflow-hidden border-b-6 border-sena-green hover:border-b-4 hover:translate-y-0.5 cursor-pointer min-h-[290px]"
            >
              <div className="w-full flex items-center justify-between text-[10px] font-black tracking-widest uppercase text-white/70">
                <span>Calendario Maestro</span>
                <span className="px-2 py-0.5 rounded bg-sena-green text-white">
                  SENA
                </span>
              </div>

              <div className="my-2 flex flex-col items-center gap-3.5">
                <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-xs group-hover:bg-sena-green group-hover:scale-105 transition-all duration-300 border border-white/20 shadow-md">
                  <CalendarRange className="w-11 h-11 text-white" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    Disponibilidad
                  </h3>
                  <p className="text-xs text-blue-100 leading-relaxed font-medium max-w-[230px]">
                    Consulta programación de ambientes, horarios de formación y
                    reservas en tiempo real.
                  </p>
                </div>
              </div>

              <div className="w-full py-2.5 px-4 rounded-xl bg-white/10 group-hover:bg-sena-green text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                <span>Abrir Calendario de Ambientes</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* Modal de Aprobaciones de Biblioteca y Ambiente 107 / Cocina */}
        <LibraryApprovalModal userEmail={userEmail || usernameStr} />
        <Ambiente107ApprovalModal userEmail={userEmail || usernameStr} />

        {/* Modal de Pánico */}
        {showPanicModal && (
          <PanicButtonModal
            user={user}
            location={user.area || ""}
            onCancel={() => setShowPanicModal(false)}
            onSuccess={onCancel}
          />
        )}

        {/* Modal Redirección Soporte */}
        {showSupportRedirect && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8 text-center animate-in zoom-in-95 duration-300">
              <SupportRedirectMessage
                showBackButton
                onClose={() => setShowSupportRedirect(false)}
              />
            </div>
          </div>
        )}

        <AuditoriumMaintenanceModal
          isOpen={showMaintenanceModal}
          onClose={() => setShowMaintenanceModal(false)}
          config={activeModalConfig}
        />
      </div>
    );
  }

  // --- VISTA DE FORMULARIO (WRAPPER COMÚN CON TRANSICIÓN <1s) ---
  return (
    <div
      key={view}
      className={`swiss-view-enter w-full mx-auto ${
        view === "RESERVATION" || view === "AVAILABILITY"
          ? "max-w-[1560px]"
          : "max-w-4xl"
      }`}
    >
      <button
        onClick={() => handleViewChange("SELECTION")}
        className="mb-6 flex items-center gap-2 text-gray-500 hover:text-sena-blue transition-colors font-bold"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al menú
      </button>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* HEADER DEL FORMULARIO */}
        <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center gap-4">
          <div
            className={`p-3 rounded-full ${
              view === "TICKET"
                ? "bg-green-100 text-sena-green"
                : view === "RESERVATION"
                  ? "bg-blue-100 text-sena-blue"
                  : view === "AVAILABILITY"
                    ? "bg-sena-blue/10 text-sena-blue"
                    : "bg-sena-green/10 text-sena-green"
            }`}
          >
            {view === "TICKET" ? (
              <Monitor className="w-6 h-6" />
            ) : view === "RESERVATION" ? (
              <Calendar className="w-6 h-6" />
            ) : view === "AVAILABILITY" ? (
              <CalendarRange className="w-6 h-6" />
            ) : (
              <Book className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {view === "TICKET"
                ? "Servicio Técnico"
                : view === "RESERVATION"
                  ? selectedReservationSpace === "1"
                    ? "Reservar Auditorio 103"
                    : selectedReservationSpace === "3"
                      ? "Reservar Biblioteca"
                      : selectedReservationSpace === "4"
                        ? "Reservar Ambiente 107"
                        : selectedReservationSpace === "5"
                          ? "Reservar Ambiente de Cocina"
                          : "Reservar Subdirección"
                  : calendarInitialSpace !== "ALL"
                    ? `Disponibilidad y Reserva — ${resolveSpaceDisplayName(calendarInitialSpace)}`
                    : "Disponibilidad de Ambientes"}
            </h2>
            <p className="text-sm text-gray-500">
              {view === "TICKET"
                ? "Completa los detalles para asignar un técnico."
                : view === "RESERVATION"
                  ? "Verifica disponibilidad y agenda tu evento."
                  : "Consulta la programación (Diaria, Semanal o Mensual) y haz clic en una hora libre para reservar."}
            </p>
          </div>
        </div>

        <div
          className={
            view === "AVAILABILITY" ? "p-4 sm:p-6 bg-slate-50/70" : "p-8"
          }
        >
          {view === "RESERVATION" ? (
            <AuditoriumReservationForm
              user={user}
              initialSpace={selectedReservationSpace}
              initialDate={reservationPrefill?.date}
              initialStartTime={reservationPrefill?.startTime}
              initialEndTime={reservationPrefill?.endTime}
              onCancel={() => handleViewChange("AVAILABILITY")}
              onSuccess={onCancel}
            />
          ) : view === "AVAILABILITY" ? (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.32fr)_minmax(395px,1fr)] gap-5 items-start">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs min-w-0">
                <UnifiedAvailabilityCalendar
                  user={
                    user as unknown as {
                      id?: string;
                      role?: string;
                      employment_type?: string;
                      job_category?: string;
                      is_vip?: boolean;
                      perm_manage_assignments?: boolean;
                    }
                  }
                  initialSpaceId={calendarInitialSpace}
                  selectedSlot={selectedSlot}
                  onSelectSlot={({ spaceId, date, startTime, endTime }) => {
                    setSelectedReservationSpace(
                      spaceId as "1" | "2" | "3" | "4" | "5",
                    );
                    setReservationPrefill({ date, startTime, endTime });
                    setSelectedSlot({ spaceId, date, startTime, endTime });
                  }}
                  onDateChange={(date) => {
                    setReservationPrefill((prev) => ({
                      date,
                      startTime: prev?.startTime || selectedSlot.startTime,
                      endTime: prev?.endTime || selectedSlot.endTime,
                    }));
                    setSelectedSlot((prev) => ({ ...prev, date }));
                  }}
                />
              </div>

              <div className="min-w-0">
                <AuditoriumReservationForm
                  variant="split"
                  user={user}
                  initialSpace={selectedReservationSpace}
                  initialDate={reservationPrefill?.date}
                  initialStartTime={reservationPrefill?.startTime}
                  initialEndTime={reservationPrefill?.endTime}
                  onSelectionChange={handleFormSelectionChange}
                  onCancel={() => handleViewChange("SELECTION")}
                  onSuccess={onCancel}
                />
              </div>
            </div>
          ) : (
            <div className="py-12">
              <SupportRedirectMessage />
            </div>
          )}
        </div>
      </div>

      <AuditoriumMaintenanceModal
        isOpen={showMaintenanceModal}
        onClose={() => setShowMaintenanceModal(false)}
        config={activeModalConfig}
      />
    </div>
  );
}
