"use client";

import { useEffect, useState } from "react";
import {
  Monitor,
  Send,
  Calendar,
  ArrowLeft,
  CalendarRange,
  Book, // Added Book icon
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PanicButtonModal from "./PanicButtonModal";
import LibraryApprovalModal from "@/features/reservations/components/LibraryApprovalModal";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import AuditoriumMaintenanceModal from "@/features/reservations/components/AuditoriumMaintenanceModal";
import {
  getAuditoriumMaintenanceConfig,
  DEFAULT_AUDITORIUM_MAINTENANCE,
} from "@/features/reservations/services/maintenanceService";
import { SpaceMaintenanceConfig } from "@/features/reservations/types";
import AssignmentManager from "@/features/assignments/components/AssignmentManager";
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
    if (currentView && currentView !== view) {
      setView(currentView);
    }
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
    "1" | "2" | "3"
  >("1");

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
  const [maintenanceConfig, setMaintenanceConfig] =
    useState<SpaceMaintenanceConfig>(DEFAULT_AUDITORIUM_MAINTENANCE);

  useEffect(() => {
    getAuditoriumMaintenanceConfig().then((cfg) => {
      setMaintenanceConfig(cfg);
    });
  }, []);

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
  const isInstructor =
    (
      user as never as { job_category?: string }
    )?.job_category?.toLowerCase() === "instructor";
  const isPlanta = (
    user as never as { employment_type?: string }
  )?.employment_type
    ?.toLowerCase()
    .includes("planta");
  const canSeeBiblioteca =
    [
      "egutierrezn@sistema.local",
      "rbiblioteca@sistema.local",
      "emgutierrezn@sena.edu.co",
    ].includes(userEmail) ||
    isAdmin ||
    isInstructor ||
    isPlanta ||
    isVip;

  // --- VISTA DE SELECCIÓN (3 COLUMNAS) ---
  if (view === "SELECTION") {
    return (
      <div className="w-full max-w-[1400px] mx-auto animate-in fade-in zoom-in duration-700 px-4 py-8">
        <div className="mb-12 text-center group">
          <h2 className="text-4xl lg:text-5xl font-black text-sena-blue tracking-tight transition-transform duration-500 group-hover:scale-105">
            ¿En qué podemos{" "}
            <span className="text-sena-green">ayudarte hoy?</span>
          </h2>
          <div className="w-24 h-1.5 bg-sena-green mx-auto mt-4 rounded-full opacity-50 group-hover:w-48 transition-all duration-500" />
          <p className="text-gray-500 mt-6 font-semibold text-lg max-w-2xl mx-auto">
            Hemos organizado nuestras herramientas para brindarte una respuesta
            más ágil y efectiva.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-stretch">
          {/* COLUMNA 1: RESUMEN DE EVENTOS DE HOY */}
          <div className="flex flex-col gap-8 h-full bg-slate-50/50 rounded-[3rem] p-4 lg:p-8 border border-slate-100/50">
            <div className="flex items-center gap-3 px-4">
              <div className="w-3 h-8 bg-sena-green rounded-full shadow-sm shadow-green-200" />
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sena-green opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sena-green"></span>
                </span>
                Eventos de Hoy
              </h4>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col gap-4 flex-grow overflow-y-auto max-h-[380px] scrollbar-thin scrollbar-thumb-gray-200 min-h-[320px]">
              {loadingReservations ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-sena-green" />
                  <span className="text-xs font-bold">Cargando eventos...</span>
                </div>
              ) : todayReservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 text-center h-full">
                  <Clock className="w-10 h-10 text-slate-300" />
                  <span className="text-sm font-black text-slate-700">
                    No hay reservas
                  </span>
                  <span className="text-xs">
                    No se han registrado eventos para hoy.
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayReservations.map((res) => {
                    const start = new Date(res.start_time);
                    const end = new Date(res.end_time);
                    const formatTime = (d: Date) =>
                      d.toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "America/Bogota",
                      });

                    const isLib = String(res.auditorium_id) === "3";
                    const isSub = String(res.auditorium_id) === "2";

                    return (
                      <div
                        key={res.id}
                        className={`p-4 rounded-2xl border border-l-4 shadow-sm flex flex-col gap-1.5 transition-all hover:scale-[1.01] ${
                          isLib
                            ? "bg-purple-50/50 border-purple-100 border-l-purple-600"
                            : isSub
                              ? "bg-orange-50/50 border-orange-100 border-l-sena-orange"
                              : "bg-blue-50/50 border-blue-100 border-l-sena-blue"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-black text-sm text-slate-800 leading-tight line-clamp-2">
                            {res.title}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                              isLib
                                ? "bg-purple-100 text-purple-700"
                                : isSub
                                  ? "bg-orange-100 text-sena-orange"
                                  : "bg-blue-100 text-sena-blue"
                            }`}
                          >
                            {isLib
                              ? "Biblioteca"
                              : isSub
                                ? "Subdirección"
                                : "Auditorio"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{`${formatTime(start)} - ${formatTime(end)}`}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Por: {res.users?.full_name || "Funcionario"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA 2: RESERVAS */}
          <div className="flex flex-col gap-8 h-full bg-slate-50/50 rounded-[3rem] p-4 lg:p-8 border border-slate-100/50">
            <div className="flex items-center gap-3 px-4">
              <div className="w-3 h-8 bg-sena-blue rounded-full shadow-sm shadow-blue-200" />
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">
                Reservas & Espacios
              </h4>
            </div>

            <div className="flex flex-col gap-5 h-full">
              {/* AUDITORIO */}
              <button
                onClick={() => {
                  if (
                    maintenanceConfig.is_active &&
                    !["admin", "superadmin"].includes(
                      ((user?.role as string) || "").toLowerCase(),
                    )
                  ) {
                    setShowMaintenanceModal(true);
                    return;
                  }
                  setSelectedReservationSpace("1");
                  handleViewChange("RESERVATION");
                }}
                className="group flex items-center gap-6 bg-white p-7 rounded-[2rem] shadow-sm hover:shadow-xl border-2 border-slate-50 hover:border-sena-blue transition-all duration-300 text-left w-full h-full relative"
              >
                {maintenanceConfig.is_active && (
                  <span className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs animate-pulse">
                    En Remodelación
                  </span>
                )}
                <div className="bg-blue-50 p-5 rounded-2xl group-hover:bg-sena-blue transition-all duration-300 group-hover:rotate-6">
                  <Calendar className="w-10 h-10 text-sena-blue group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-800 group-hover:text-sena-blue transition-colors">
                    Auditorio
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-semibold italic opacity-70 group-hover:opacity-100">
                    Capacitaciones institucionales.
                  </p>
                </div>
              </button>

              {/* SUBDIRECCIÓN */}
              {canSeeSubdireccion && (
                <button
                  onClick={() => {
                    setSelectedReservationSpace("2");
                    handleViewChange("RESERVATION");
                  }}
                  className="group flex items-center gap-6 bg-white p-7 rounded-[2rem] shadow-sm hover:shadow-xl border-2 border-slate-50 hover:border-sena-orange transition-all duration-300 text-left w-full h-full"
                >
                  <div className="bg-orange-50 p-5 rounded-2xl group-hover:bg-sena-orange transition-all duration-300 group-hover:-rotate-6">
                    <Calendar className="w-10 h-10 text-sena-orange group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-gray-800 group-hover:text-sena-orange transition-colors">
                      Subdirección
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 font-semibold italic opacity-70 group-hover:opacity-100">
                      Reuniones de alta gerencia.
                    </p>
                  </div>
                </button>
              )}

              {/* BIBLIOTECA */}
              {canSeeBiblioteca && (
                <button
                  onClick={() => {
                    setSelectedReservationSpace("3");
                    handleViewChange("RESERVATION");
                  }}
                  className="group flex items-center gap-6 bg-white p-7 rounded-[2rem] shadow-sm hover:shadow-xl border-2 border-slate-50 hover:border-purple-500 transition-all duration-300 text-left w-full h-full"
                >
                  <div className="bg-purple-50 p-5 rounded-2xl group-hover:bg-purple-600 transition-all duration-300 group-hover:scale-110">
                    <Book className="w-10 h-10 text-purple-600 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-gray-800 group-hover:text-purple-600 transition-colors">
                      Biblioteca
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 font-semibold italic opacity-70 group-hover:opacity-100">
                      Entornos de aprendizaje.
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* COLUMNA 3: INFO & SERVICIOS */}
          <div className="flex flex-col gap-8 h-full">
            <div className="flex items-center gap-3 px-4">
              <div className="w-3 h-8 bg-pink-500 rounded-full shadow-sm shadow-pink-200" />
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">
                Servicios & Consulta
              </h4>
            </div>

            <div className="flex flex-col gap-6 h-full justify-center">
              {/* DISPONIBILIDAD */}
              <button
                onClick={() => handleViewChange("AVAILABILITY")}
                className="group relative bg-gradient-to-br from-pink-500 to-rose-600 p-10 rounded-[2.5rem] shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center gap-6 h-full min-h-[450px] justify-center overflow-hidden border-b-8 border-pink-700 hover:border-b-4 hover:translate-y-1"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-700 blur-xl" />

                <div className="relative z-10 bg-white/20 p-8 rounded-[2rem] backdrop-blur-md group-hover:bg-white group-hover:scale-110 transition-all duration-500 shadow-xl border border-white/30 group-hover:border-transparent">
                  <CalendarRange className="w-16 h-16 text-white group-hover:text-pink-600" />
                </div>
                <div className="relative z-10 space-y-3">
                  <h3 className="text-3xl font-black text-white">
                    Disponibilidad
                  </h3>
                  <p className="text-base text-pink-50 leading-relaxed font-semibold opacity-90">
                    Ambientes y programación en tiempo real.
                  </p>
                </div>

                <div className="absolute top-4 right-6 text-white/40 text-[10px] font-black tracking-widest uppercase">
                  Consulta Pública
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <button
            onClick={onCancel}
            className="group px-10 py-4 bg-white border-2 border-slate-200 text-slate-400 rounded-3xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all text-sm font-black flex items-center gap-3 mx-auto shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-2 transition-transform" />
            FINALIZAR SESIÓN
          </button>
        </div>

        {/* Modal de Aprobaciones de Biblioteca */}
        <LibraryApprovalModal userEmail={userEmail} />

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
      </div>
    );
  }

  // --- VISTA DE FORMULARIO (WRAPPER COMÚN) ---
  return (
    <div
      className={`w-full mx-auto animate-in fade-in slide-in-from-right-8 duration-300 ${
        view === "RESERVATION" || view === "AVAILABILITY"
          ? "max-w-6xl"
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
                    ? "bg-pink-100 text-pink-600"
                    : "bg-purple-100 text-purple-600"
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
                    ? "Reservar Auditorio"
                    : "Reservar Subdirección"
                  : "Disponibilidad de Ambientes"}
            </h2>
            <p className="text-sm text-gray-500">
              {view === "TICKET"
                ? "Completa los detalles para asignar un técnico."
                : view === "RESERVATION"
                  ? "Verifica disponibilidad y agenda tu evento."
                  : "Consulta y gestión de asignaciones de instructores."}
            </p>
          </div>
        </div>

        <div className="p-8">
          {view === "RESERVATION" ? (
            <AuditoriumReservationForm
              user={user}
              initialSpace={selectedReservationSpace}
              onCancel={() => handleViewChange("SELECTION")}
              onSuccess={onCancel}
            />
          ) : view === "AVAILABILITY" ? (
            <div className="min-h-[600px]">
              <AssignmentManager
                canManage={
                  user.role === "admin" ||
                  user.role === "superadmin" ||
                  user.role === "coordinator" ||
                  !!user.perm_manage_assignments
                }
                canDeleteAuditorium={
                  user.role === "superadmin" ||
                  user.role === "admin" ||
                  !!user.is_vip
                }
                user={user}
              />
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
        config={maintenanceConfig}
      />
    </div>
  );
}
