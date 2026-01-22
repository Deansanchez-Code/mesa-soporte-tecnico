"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase/cliente";
import {
  User,
  ArrowRight,
  Loader2,
  Lock,
  Monitor,
  Calendar,
  MapPin,
} from "lucide-react";
import UserRequestForm from "@/features/requests/components/UserRequestForm";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface UserData {
  id: string;
  username: string;
  full_name: string;
  area: string;
  role: string;
  [key: string]: unknown;
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

  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [contractorLocation, setContractorLocation] = useState("");

  // Cargar áreas disponibles al montar
  useEffect(() => {
    const fetchAreas = async () => {
      const { data } = await supabase
        .from("areas")
        .select("name")
        .order("name");
      if (data) {
        setAvailableAreas(data.map((a) => a.name));
      }
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const role = session.user.user_metadata?.role;
        if (role === "admin" || role === "superadmin") {
          // Admin logic remains same
        } else if (session.user.user_metadata) {
          // Consultar datos frescos de la base de datos para asegurar nombre correcto
          const { data: dbUser } = await supabase
            .from("users")
            .select("id, full_name, area")
            .eq("id", session.user.id)
            .maybeSingle();

          const user = {
            id: dbUser?.id || session.user.id, // Preferir ID de DB pública si existe (para FKs)
            username: session.user.user_metadata.username,
            full_name:
              dbUser?.full_name || session.user.user_metadata.full_name, // Prioridad DB
            role: session.user.user_metadata.role,
            area: dbUser?.area || session.user.user_metadata.area,
          };
          setUserData(user as UserData);
          setViewState("request");
        }
      }
    };

    fetchAreas();
    checkSession();
  }, []);

  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location");

  // Estado para controlar el ancho del contenedor según la vista interna del formulario
  const [requestView, setRequestView] = useState<
    "SELECTION" | "TICKET" | "RESERVATION" | "AVAILABILITY"
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
        else if (step === "AVAILABILITY") setRequestView("AVAILABILITY");
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

    try {
      const cleanUsername = username.split("@")[0].toLowerCase().trim();
      const res = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const { user } = await res.json();

      if (user && (user.role === "admin" || user.role === "superadmin")) {
        setLoading(false);
        alert(
          "Los administradores deben usar su cuenta de funcionario o instructor para reportar casos.",
        );
        return;
      }

      setLoading(false);

      if (user) {
        // --- INICIO SILENT LOGIN ---
        const cleanUsername = user.username.toLowerCase().trim();
        const syntheticEmail = `${cleanUsername}@sistema.local`.toLowerCase();

        const { error: authError } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: "Sena2024*",
        });

        if (authError) {
          console.error("Silent Login Error:", authError.message);
          // Si es un error de credenciales, avisar que se está sincronizando
          if (authError.message.includes("Invalid login credentials")) {
            alert(
              "Sincronizando acceso... Por favor presiona CONTINUAR una vez más.",
            );
          } else {
            alert(`Error de acceso: ${authError.message}`);
          }
          setLoading(false);
          return;
        }
        // --- FIN SILENT LOGIN ---

        setUserData(user);
        setViewState("request");
      } else {
        setLoginError(true);
      }
    } catch (e) {
      console.error("Login check failed:", e);
      setLoading(false);
      setLoginError(true);
    }
  };

  // --- LOGIN CONTRATISTA / EXTERNO ---
  const handleContractorSubmit = async () => {
    if (!contractorName || !contractorEmail) return;

    // Validación de ubicación para Funcionarios
    if (contractorArea === "Contratista" && !contractorLocation) {
      alert("Por favor selecciona dónde te encuentras ubicado.");
      return;
    }

    setLoading(true);

    const derivedUsername = contractorEmail.split("@")[0].toLowerCase().trim();
    const finalArea =
      contractorArea === "Contratista"
        ? contractorLocation
        : "PORTERIA PEATONAL";

    // Validación de correo institucional
    if (contractorEmail.toLowerCase().endsWith("@sena.edu.co")) {
      alert(
        "Los correos @sena.edu.co deben ingresar por el 'Ingreso Corporativo'.",
      );
      setLoading(false);
      return;
    }

    try {
      // 1. Buscar si ya existe
      const checkRes = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: derivedUsername }),
      });
      const { user: existingUser } = await checkRes.json();

      if (existingUser) {
        // --- INICIO SILENT LOGIN ---
        const cleanUsername = existingUser.username.toLowerCase().trim();
        const syntheticEmail = `${cleanUsername}@sistema.local`;
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: "Sena2024*",
        });

        if (authError) {
          console.error("Silent Login Error (Existing Contractor):", authError);
          alert("Error de autenticación como contratista. Intenta nuevamente.");
          setLoading(false);
          return;
        }
        // ---------------------------

        setUserData(existingUser);
        setViewState("request");
      } else {
        // 2. Crear
        // Mapping UI state to backend fields:
        // contractorArea state: "Instructor" -> Instructor
        // contractorArea state: "Contratista" -> Funcionario (per button label)

        // Bloquear @sena.edu.co DE NUEVO por seguridad
        if (contractorEmail.toLowerCase().endsWith("@sena.edu.co")) {
          alert(
            "Los correos @sena.edu.co deben ingresar por el 'Ingreso Corporativo'.",
          );
          setLoading(false);
          return;
        }

        const isInstructor = contractorArea === "Instructor";
        const jobCategory = isInstructor ? "instructor" : "funcionario";

        const createRes = await fetch("/api/auth/register-contractor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: derivedUsername,
            full_name: contractorName,
            email: contractorEmail,
            role: "contractor", // Role strictly enforced as contractor
            job_category: jobCategory,
            employment_type: "contratista", // ALWAYS contratista from portal
            area: finalArea,
            location: finalArea,
          }),
        });

        const { user: newUser, error: createError } = await createRes.json();

        if (createError) throw new Error(createError);

        // --- INICIO SILENT LOGIN (NUEVO USUARIO) ---
        if (newUser) {
          const cleanUsername = newUser.username.toLowerCase().trim();
          const newSyntheticEmail = `${cleanUsername}@sistema.local`;
          const { error: authError } = await supabase.auth.signInWithPassword({
            email: newSyntheticEmail,
            password: "Sena2024*",
          });

          if (authError) {
            console.error("Silent Login Error (New Contractor):", authError);
            alert(
              "Usuario creado pero no se pudo iniciar sesión automáticamente. Por favor recarga e intenta de nuevo.",
            );
            setLoading(false);
            return;
          }
        }
        // -------------------------------------------

        setUserData(newUser);
        setViewState("request");
      }

      setViewState("request");
    } catch (error) {
      console.error("Error en registro de contratista:", error);
      alert(
        "Error al procesar el ingreso. Verifica tus datos o intenta nuevamente.",
      );
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
              ) : requestView === "AVAILABILITY" ? (
                <MapPin className="w-8 h-8 text-white" />
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

              {/* DROPDOWN DE UBICACIÓN (SOLO PARA FUNCIONARIOS) */}
              {contractorArea === "Contratista" && (
                <div className="space-y-1 animate-in slide-in-from-top-2 fade-in">
                  <label className="text-xs font-bold text-gray-600 ml-1">
                    Ubicación <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={contractorLocation}
                    onChange={(e) => setContractorLocation(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-orange outline-none bg-white font-medium text-gray-700"
                  >
                    <option value="">-- Selecciona una ubicación --</option>
                    {availableAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                onCancel={async () => {
                  await supabase.auth.signOut();
                  setViewState("login");
                  setUsername("");
                  setUserData(null);
                  setContractorName("");
                  setContractorEmail("");
                  setRequestView("SELECTION");
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
