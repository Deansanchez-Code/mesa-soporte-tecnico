"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import {
  User,
  ArrowRight,
  Loader2,
  Lock,
  Monitor,
  Calendar,
} from "lucide-react"; // Agregamos Lock, Monitor, Calendar
import UserRequestForm from "@/components/UserRequestForm";
import Link from "next/link"; // Importante para la navegación
import { useSearchParams } from "next/navigation";

interface UserData {
  id: string;
  username: string;
  full_name: string;
  area: string;
  role: string;
}

function HomeContent() {
  // Estados de Vista
  const [viewState, setViewState] = useState<
    "login" | "contractor" | "request"
  >("login");

  // Estados Login Corporativo
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // Estados Registro Contratista
  const [contractorName, setContractorName] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorArea, setContractorArea] = useState<
    "Instructor" | "Contratista"
  >("Contratista");

  // Datos de Usuario (Compartido)
  const [userData, setUserData] = useState<UserData | null>(null);

  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location");

  // Estado para controlar el ancho del contenedor según la vista interna del formulario
  const [requestView, setRequestView] = useState<
    "SELECTION" | "TICKET" | "RESERVATION"
  >("SELECTION");

  // Sincronización con URL para soporte de botón "Atrás"
  useEffect(() => {
    // Función para manejar cambios en la URL (popstate)
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const step = params.get("step");

      if (view === "request") {
        setViewState("request");
        if (step === "TICKET") setRequestView("TICKET");
        else if (step === "RESERVATION") setRequestView("RESERVATION");
        else setRequestView("SELECTION");
      } else if (view === "contractor") {
        setViewState("contractor");
      } else {
        setViewState("login");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Actualizar URL cuando cambia el estado
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentView = params.get("view");
    const currentStep = params.get("step");

    let newUrl = "";

    if (viewState === "login") {
      if (currentView !== null) newUrl = "/";
    } else if (viewState === "contractor") {
      if (currentView !== "contractor") newUrl = "/?view=contractor";
    } else if (viewState === "request") {
      if (requestView === "SELECTION") {
        if (currentView !== "request" || currentStep) newUrl = "/?view=request";
      } else {
        if (currentStep !== requestView)
          newUrl = `/?view=request&step=${requestView}`;
      }
    }

    if (newUrl) {
      window.history.pushState(null, "", newUrl);
    }
  }, [viewState, requestView]);

  // --- LOGIN CORPORATIVO ---
  const handleCorporateLogin = async () => {
    if (!username) return;
    setLoading(true);
    setLoginError(false);

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .single();

    setLoading(false);

    if (data) {
      setUserData(data);
      setViewState("request");
    } else {
      setLoginError(true);
    }
  };

  // --- LOGIN CONTRATISTA / EXTERNO ---
  const handleContractorSubmit = async () => {
    if (!contractorName || !contractorEmail) return;
    setLoading(true);

    const derivedUsername = contractorEmail.split("@")[0].toLowerCase().trim();

    try {
      // 1. Buscar si ya existe
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("username", derivedUsername)
        .single();

      if (existingUser) {
        // Si existe, actualizamos sus datos para mantenerlos frescos
        const { data: updatedUser, error: updateError } = await supabase
          .from("users")
          .update({
            full_name: contractorName,
            area: contractorArea,
            // No tocamos el rol existente
          })
          .eq("id", existingUser.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setUserData(updatedUser);
      } else {
        // Si no existe, creamos uno nuevo
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({
            username: derivedUsername,
            full_name: contractorName,
            area: contractorArea,
            role: "external", // Rol específico para externos
            password: "EXTERNAL_NO_PASS", // Placeholder
          })
          .select()
          .single();

        if (createError) throw createError;
        setUserData(newUser);
      }

      setViewState("request");
    } catch (error) {
      console.error("Error en registro de contratista:", error);
      alert("Error al procesar el ingreso. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-4">
      {/* CINTILLO SUPERIOR */}
      <div className="fixed top-0 left-0 w-full h-2 bg-sena-green"></div>

      {/* TARJETA PRINCIPAL */}
      <div
        className={`bg-white w-full rounded-xl shadow-2xl overflow-hidden border-t-4 border-sena-green transition-all duration-300 ${
          viewState === "request"
            ? requestView === "SELECTION"
              ? "max-w-md"
              : "max-w-3xl"
            : "max-w-md"
        }`}
      >
        {/* HEADER (Solo visible si no estamos en el formulario de solicitud) */}
        {viewState !== "request" && (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center shadow-lg mb-4 bg-sena-green transition-colors">
              <User className="text-white w-12 h-12" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-sena-blue">
                Mesa de Ayuda <span className="text-sena-green">TIC</span>
              </h1>
              <p className="text-sena-orange font-semibold text-sm">
                Centro Agroempresarial y Desarrollo Pecuario del Huila
              </p>
            </div>

            <p className="text-gray-500 text-sm">
              Gestión de Incidentes y Requerimientos
            </p>
          </div>
        )}

        {/* HEADER DINÁMICO (Visible en todos los formularios internos) */}
        {viewState === "request" && userData && (
          <div className="bg-sena-green p-6 flex items-center gap-4 text-white animate-in slide-in-from-top duration-300">
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm border border-white/30">
              {requestView === "TICKET" ? (
                <Monitor className="w-8 h-8 text-white" />
              ) : requestView === "RESERVATION" ? (
                <Calendar className="w-8 h-8 text-white" />
              ) : (
                <User className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold leading-none text-white">
                Mesa de Ayuda <span className="text-sena-blue">TIC</span>
              </h2>
              <p className="text-sm text-gray-100 mt-1 font-medium uppercase tracking-wide">
                {userData.full_name}
              </p>
            </div>
          </div>
        )}

        {/* BODY */}
        <div
          className={viewState === "request" ? "p-0" : "px-8 pb-8 space-y-6"}
        >
          {/* --- VISTA 1: LOGIN CORPORATIVO --- */}
          {viewState === "login" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-sena-blue ml-1">
                  Usuario Corporativo
                </label>
                <input
                  type="text"
                  placeholder="ej: jpereza"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCorporateLogin()}
                  className={`w-full pl-4 pr-4 py-3 border rounded-lg outline-none transition ${
                    loginError
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 focus:ring-2 focus:ring-sena-green"
                  }`}
                />
                {loginError && (
                  <p className="text-xs text-red-500 font-medium ml-1">
                    Usuario no encontrado.
                  </p>
                )}
              </div>

              <button
                onClick={handleCorporateLogin}
                disabled={loading}
                className="w-full bg-sena-green hover:bg-[#2d8500] text-white py-3 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    CONTINUAR
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-[1px] bg-gray-300 flex-1"></div>
                <span className="text-xs text-gray-400 font-medium">O</span>
                <div className="h-[1px] bg-gray-300 flex-1"></div>
              </div>

              <button
                onClick={() => setViewState("contractor")}
                className="w-full bg-white border-2 border-sena-orange text-sena-orange hover:bg-orange-50 font-bold py-3 rounded-lg transition text-sm cursor-pointer"
              >
                SOY CONTRATISTA
              </button>
            </>
          )}

          {/* --- VISTA 2: FORMULARIO CONTRATISTA --- */}
          {viewState === "contractor" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-xs text-orange-800 mb-4">
                Ingresa tus datos para generar la solicitud de soporte.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 ml-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-orange outline-none"
                  placeholder="Ej: Carlos Rodriguez"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 ml-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={contractorEmail}
                  onChange={(e) => setContractorEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-orange outline-none"
                  placeholder="Ej: crodriguez@email.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 ml-1">
                  Tipo de Vinculación
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setContractorArea("Contratista")}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      contractorArea === "Contratista"
                        ? "bg-sena-orange text-white border-sena-orange"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Funcionario
                  </button>
                  <button
                    onClick={() => setContractorArea("Instructor")}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      contractorArea === "Instructor"
                        ? "bg-sena-orange text-white border-sena-orange"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Instructor
                  </button>
                </div>
              </div>

              <button
                onClick={handleContractorSubmit}
                disabled={loading || !contractorName || !contractorEmail}
                className="w-full bg-sena-orange hover:bg-orange-600 text-white py-3 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    INGRESAR SOLICITUD
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={() => setViewState("login")}
                className="w-full text-gray-400 text-xs hover:text-gray-600 py-2"
              >
                Volver al inicio
              </button>
            </div>
          )}

          {/* --- VISTA 3: FORMULARIO DE SOLICITUD (UserRequestForm) --- */}
          {viewState === "request" && userData && (
            <div className="p-6">
              <UserRequestForm
                user={userData}
                onCancel={() => {
                  setViewState("login");
                  setUsername("");
                  setUserData(null);
                  // Reset contractor form
                  setContractorName("");
                  setContractorEmail("");
                  setRequestView("SELECTION"); // Reset view state
                }}
                initialLocation={locationParam || undefined}
                onViewChange={setRequestView}
                currentView={requestView}
              />
            </div>
          )}
        </div>

        {/* FOOTER */}
        {viewState !== "request" && (
          <div className="bg-gray-100 p-4 text-center border-t border-gray-200">
            <p className="text-gray-400 text-xs mb-2">
              Servicio Nacional de Aprendizaje - SENA
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-sena-blue hover:underline opacity-60 hover:opacity-100 transition"
            >
              <Lock className="w-3 h-3" />
              ACCESO FUNCIONARIOS TIC
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-10 h-10 animate-spin text-sena-green" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
