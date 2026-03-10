"use client";

import { useEffect, useState } from "react";
import {
  Monitor,
  Send,
  Calendar,
  ArrowLeft,
  CalendarRange,
  Book, // Added Book icon
} from "lucide-react";
import PanicButtonModal from "./PanicButtonModal";
import LibraryApprovalModal from "@/features/reservations/components/LibraryApprovalModal";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import AssignmentManager from "@/features/assignments/components/AssignmentManager";
import { User } from "./types";

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
          {/* COLUMNA 1: SOPORTE TÉCNICO */}
          <div className="flex flex-col gap-8 h-full">
            <div className="flex items-center gap-3 px-4">
              <div className="w-3 h-8 bg-sena-green rounded-full shadow-sm shadow-green-200" />
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">
                Soporte & Tecnología
              </h4>
            </div>

            <button
              onClick={() => setShowSupportRedirect(true)}
              className="group relative bg-white p-10 rounded-[2.5rem] shadow-sm hover:shadow-2xl border-2 border-slate-100 hover:border-sena-green transition-all duration-500 flex flex-col items-center text-center gap-6 h-full min-h-[420px] justify-center overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-700 opacity-40 blur-2xl" />

              <div className="relative z-10 bg-green-50 p-8 rounded-[2rem] group-hover:bg-sena-green group-hover:scale-110 transition-all duration-500 shadow-inner">
                <Monitor className="w-16 h-16 text-sena-green group-hover:text-white" />
              </div>
              <div className="relative z-10 space-y-4">
                <h3 className="text-3xl font-black text-slate-800 group-hover:text-sena-green transition-colors leading-tight">
                  Servicio Técnico
                </h3>
                <p className="text-base text-slate-500 leading-relaxed font-medium">
                  Atención especializada para fallas en equipos, conectividad,
                  desarrollo de software o soporte de impresión.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3 text-sena-green font-black text-sm opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500 bg-green-50 px-6 py-2 rounded-full border border-green-100">
                CONTACTAR SOPORTE <Send className="w-4 h-4 ml-1" />
              </div>
            </button>
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
                  setSelectedReservationSpace("1");
                  handleViewChange("RESERVATION");
                }}
                className="group flex items-center gap-6 bg-white p-7 rounded-[2rem] shadow-sm hover:shadow-xl border-2 border-slate-50 hover:border-sena-blue transition-all duration-300 text-left w-full h-full"
              >
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
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <Monitor className="w-10 h-10 text-sena-green" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-4">
                ¡Gracias por tu confianza!
              </h3>
              <p className="text-slate-600 mb-8 leading-relaxed font-medium">
                Agradecemos la confianza depositada en el uso del desarrollo del
                aplicativo. Te informamos que el sistema seguirá funcionando con
                normalidad para la{" "}
                <strong>reserva de Auditorio y Biblioteca</strong>.
                <br />
                <br />A partir de ahora, los casos de servicio técnico se
                manejarán directamente por correo electrónico.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="mailto:mesadeservicio@sena.edu.co"
                  onClick={() => setShowSupportRedirect(false)}
                  className="w-full py-4 bg-sena-green hover:bg-[#2d8500] text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Enviar correo a Soporte
                </a>
                <button
                  onClick={() => setShowSupportRedirect(false)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-colors"
                >
                  Volver al menú
                </button>
              </div>
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
            <div className="text-center py-12 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-500">
              <div className="mx-auto w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Monitor className="w-12 h-12 text-sena-green" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-6">
                ¡Gracias por tu confianza!
              </h3>
              <p className="text-slate-600 mb-10 text-lg leading-relaxed font-medium">
                Te informamos que el sistema seguirá funcionando con normalidad
                para la <strong>reserva de Auditorio y Biblioteca</strong>.
                <br />
                <br />A partir de ahora, los casos de servicio técnico se
                manejarán directamente por correo electrónico.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:mesadeservicio@sena.edu.co"
                  className="w-full sm:w-auto px-8 py-4 bg-sena-green hover:bg-[#2d8500] text-white rounded-2xl font-black shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-3 hover:scale-105"
                >
                  <Send className="w-5 h-5" />
                  Enviar correo a Soporte
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
