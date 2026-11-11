"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  User,
  ArrowRight,
  Loader2,
  Lock,
  Monitor,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import UserRequestForm from "@/features/requests/components/UserRequestForm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import { buildUserIdOrFilter } from "@/lib/security";

interface UserData {
  id: string;
  username: string;
  full_name: string;
  area: string;
  role: string;
  email?: string;
  [key: string]: unknown;
}

function HomeContent() {
  const router = useRouter();
  // Estados de Vista
  const [viewState, setViewState] = useState<
    | "login"
    | "contractor"
    | "otp"
    | "pin"
    | "pin_pending"
    | "pin_removed_notice"
    | "request"
  >("login");

  // Estados Login Corporativo, PIN VIP y OTP
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState("");
  const [otpUsername, setOtpUsername] = useState("");
  const [otpMaskedEmail, setOtpMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinTargetFullName, setPinTargetFullName] = useState("");
  const [pinNoticeMessage, setPinNoticeMessage] = useState("");
  const [pinRemovedBanner, setPinRemovedBanner] = useState(false);
  const [otpReturnView, setOtpReturnView] = useState<"login" | "contractor">(
    "login",
  );
  const [resendCooldown, setResendCooldown] = useState(0);

  // Estados Registro Contratista
  const [contractorName, setContractorName] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorArea, setContractorArea] = useState<
    "Instructor" | "Contratista"
  >("Contratista");

  // Datos de Usuario (Compartido)
  const [userData, setUserData] = useState<UserData | null>(null);

  // Notificaciones en tiempo real
  useUserNotifications(userData?.id);

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
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        const { data: dbUser } = await supabase
          .from("users")
          .select(
            "id, username, full_name, role, area, employment_type, job_category, is_vip, perm_manage_assignments, email",
          )
          .or(buildUserIdOrFilter(authUser.id))
          .maybeSingle();

        const authoritativeRole = dbUser?.role || "user";
        if (
          authoritativeRole === "admin" ||
          authoritativeRole === "superadmin"
        ) {
          router.push("/dashboard");
        } else if (dbUser) {
          setUserData({
            id: dbUser.id,
            username: dbUser.username,
            full_name: dbUser.full_name || dbUser.username,
            role: authoritativeRole,
            area: dbUser.area || "",
            employment_type: dbUser.employment_type,
            job_category: dbUser.job_category,
            is_vip: !!dbUser.is_vip,
            perm_manage_assignments: !!dbUser.perm_manage_assignments,
            email: dbUser.email || authUser.email,
          });
          setViewState("request");
        }
      }
    };

    fetchAreas();
    checkSession();
  }, [router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
        if (step === "RESERVATION") setRequestView("RESERVATION");
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

  const requestOtpForUser = async (
    targetUsername: string,
    returnView: "login" | "contractor",
  ) => {
    const res = await fetch("/api/auth/kiosk-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", username: targetUsername }),
    });
    const payload = await res.json();
    if (!res.ok) {
      return {
        ok: false as const,
        status: res.status,
        error: payload.error || "No fue posible verificar acceso del usuario.",
      };
    }

    // Caso 1: Usuario estándar SENA (no VIP) -> acceso directo sin correo
    if (payload.authMode === "direct" && payload.session && payload.user) {
      const { error: setSessionErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setSessionErr) {
        return {
          ok: false as const,
          status: 500,
          error: "Error estableciendo sesión de usuario.",
        };
      }
      setUserData(payload.user as UserData);
      if (payload.pinRemovedNotice) {
        setPinTargetFullName(
          payload.fullName ||
            (payload.user as UserData)?.full_name ||
            targetUsername,
        );
        setViewState("pin_removed_notice");
      } else {
        setViewState("request");
      }
      return { ok: true as const };
    }

    // Caso 2: Usuario VIP / Coordinador -> exige PIN numérico de 6 dígitos asignado por Dinamizador TIC
    if (payload.authMode === "pin") {
      setOtpUsername(targetUsername);
      setPinTargetFullName(payload.fullName || targetUsername);
      setPinValue("");
      setPinError("");
      setPinRemovedBanner(false);
      setOtpReturnView(returnView);
      setViewState("pin");
      return { ok: true as const };
    }

    if (payload.authMode === "pin_not_configured") {
      setOtpUsername(targetUsername);
      setPinTargetFullName(payload.fullName || targetUsername);
      setPinNoticeMessage(
        payload.message ||
          "Tu perfil cuenta con privilegios VIP y requiere un PIN numérico de 6 dígitos asignado por el Dinamizador TIC.",
      );
      setPinRemovedBanner(false);
      setOtpReturnView(returnView);
      setViewState("pin_pending");
      return { ok: true as const };
    }

    // Caso 3: Correo externo personal -> OTP de 6 dígitos al correo personal
    setOtpUsername(targetUsername);
    setOtpMaskedEmail(payload.maskedEmail || "correo registrado");
    setOtpCode("");
    setOtpError("");
    setPinRemovedBanner(Boolean(payload.pinRemovedNotice));
    setPinTargetFullName(payload.fullName || targetUsername);
    setOtpReturnView(returnView);
    setResendCooldown(30);
    setViewState("otp");
    return { ok: true as const };
  };

  // --- LOGIN CORPORATIVO (DIRECTO PARA NO-VIP, PIN PARA VIP/COORD, OTP PARA DOMINIO EXTERNO) ---
  const handleCorporateLogin = async () => {
    if (!username) return;
    setLoading(true);
    setLoginError(false);
    setLoginErrorMessage("");

    try {
      const cleanUsername = username.split("@")[0].toLowerCase().trim();
      const otpReq = await requestOtpForUser(cleanUsername, "login");
      if (!otpReq.ok) {
        setLoginError(true);
        setLoginErrorMessage(otpReq.error);
      }
    } catch (e) {
      console.error("Login check failed:", e);
      setLoginError(true);
      setLoginErrorMessage("Error de conexión verificando el usuario.");
    } finally {
      setLoading(false);
    }
  };

  // --- VERIFICACIÓN DE PIN VIP DE 6 DÍGITOS ---
  const handleVerifyPin = async () => {
    if (!otpUsername || pinValue.trim().length !== 6) {
      setPinError("Ingresa tu PIN numérico de 6 dígitos.");
      return;
    }
    setLoading(true);
    setPinError("");

    try {
      const res = await fetch("/api/auth/kiosk-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_pin",
          username: otpUsername,
          pin: pinValue.trim(),
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.session || !payload.user) {
        setPinError(payload.error || "PIN inválido o bloqueado.");
        return;
      }

      const { error: setSessionErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });

      if (setSessionErr) {
        setPinError("Error estableciendo sesión segura.");
        return;
      }

      setUserData(payload.user as UserData);
      setViewState("request");
    } catch (err) {
      console.error("VIP PIN verify failed:", err);
      setPinError("Error de conexión validando el PIN.");
    } finally {
      setLoading(false);
    }
  };

  // --- VERIFICACIÓN DE CÓDIGO OTP ---
  const handleVerifyOtp = async () => {
    if (!otpUsername || otpCode.trim().length !== 6) {
      setOtpError("Ingresa el código de 6 dígitos enviado a tu correo.");
      return;
    }
    setLoading(true);
    setOtpError("");

    try {
      const res = await fetch("/api/auth/kiosk-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          username: otpUsername,
          code: otpCode.trim(),
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.session || !payload.user) {
        setOtpError(payload.error || "Código inválido o expirado.");
        return;
      }

      const { error: setSessionErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });

      if (setSessionErr) {
        setOtpError("Error estableciendo sesión segura.");
        return;
      }

      setUserData(payload.user as UserData);
      setViewState("request");
    } catch (err) {
      console.error("OTP verify failed:", err);
      setOtpError("Error de conexión validando el código.");
    } finally {
      setLoading(false);
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
      // 1. Intentar flujo de acceso si el usuario ya existe
      const existingOtp = await requestOtpForUser(
        derivedUsername,
        "contractor",
      );
      if (existingOtp.ok) {
        return;
      }

      if (existingOtp.status !== 404) {
        alert(existingOtp.error);
        return;
      }

      // 2. Registrar nuevo contratista y enviar OTP al correo para confirmar titularidad
      const isInstructor = contractorArea === "Instructor";
      const jobCategory = isInstructor ? "instructor" : "funcionario";

      const createRes = await fetch("/api/auth/register-contractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: derivedUsername,
          full_name: contractorName,
          email: contractorEmail,
          role: "contractor",
          job_category: jobCategory,
          employment_type: "contratista",
          area: finalArea,
        }),
      });

      const { user: newUser, error: createError } = await createRes.json();
      if (!createRes.ok || createError) {
        throw new Error(createError || "No se pudo completar el registro");
      }

      if (newUser) {
        const otpReq = await requestOtpForUser(
          newUser.username.toLowerCase().trim(),
          "contractor",
        );
        if (!otpReq.ok) {
          alert(otpReq.error);
        }
      }
    } catch (error) {
      console.error("Error en registro de contratista:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Error al procesar el ingreso. Verifica tus datos o intenta nuevamente.",
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
        className={`bg-white w-full rounded-2xl shadow-2xl overflow-hidden border-t-4 border-sena-green transition-all duration-500 ${
          viewState === "request" ? "max-w-[1640px]" : "max-w-md"
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
                    {loginErrorMessage || "Usuario no encontrado."}
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

          {/* --- VISTA 2.5: VERIFICACIÓN CÓDIGO OTP --- */}
          {viewState === "otp" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
              {pinRemovedBanner && (
                <div className="bg-sena-green/10 border border-sena-green/30 p-3 rounded-xl text-xs text-sena-blue">
                  <p className="font-bold flex items-center gap-1.5 text-sena-green">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Ya no requieres PIN VIP de seguridad
                  </p>
                  <p className="mt-1 text-slate-600">
                    Tus privilegios VIP fueron actualizados; confirma únicamente
                    el código enviado a tu correo personal para ingresar.
                  </p>
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900">
                <p className="font-bold">Código de verificación enviado</p>
                <p className="mt-1 text-emerald-800">
                  Enviamos un código de 6 dígitos a{" "}
                  <strong>{otpMaskedEmail}</strong> para confirmar tu identidad.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 ml-1">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-green outline-none text-center text-2xl font-mono tracking-[0.4em]"
                />
                {otpError && (
                  <p className="text-xs text-red-600 font-medium ml-1">
                    {otpError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-sena-green hover:bg-[#2d8500] text-white py-3 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    VERIFICAR E INGRESAR
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={async () => {
                    setLoading(true);
                    await requestOtpForUser(otpUsername, otpReturnView);
                    setLoading(false);
                  }}
                  className="text-sena-blue font-semibold hover:underline disabled:text-gray-400"
                >
                  {resendCooldown > 0
                    ? `Reenviar en ${resendCooldown}s`
                    : "Reenviar código"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpCode("");
                    setOtpError("");
                    setViewState(otpReturnView);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Cambiar usuario
                </button>
              </div>
            </div>
          )}

          {/* --- VISTA 2.6: VALIDACIÓN PIN NUMÉRICO VIP / COORDINADORES --- */}
          {viewState === "pin" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
              <div className="bg-sena-blue/5 border border-sena-blue/20 p-4 rounded-xl text-xs text-sena-blue space-y-1.5">
                <p className="font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-sena-blue">
                  <ShieldCheck className="w-4 h-4 text-sena-green shrink-0" />
                  Acceso Protegido VIP / Coordinación
                </p>
                <p className="text-slate-700 leading-relaxed">
                  ¡Hola, <strong>{pinTargetFullName}</strong>! Ingresa tu PIN
                  numérico de 6 dígitos asignado por el Dinamizador TIC para
                  continuar de forma segura.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-sena-blue ml-1">
                  PIN de Seguridad (6 dígitos)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={pinValue}
                  onChange={(e) =>
                    setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sena-green outline-none text-center text-2xl font-mono tracking-[0.45em]"
                />
                {pinError && (
                  <p className="text-xs text-red-600 font-medium ml-1">
                    {pinError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleVerifyPin}
                disabled={loading || pinValue.length !== 6}
                className="w-full bg-sena-green hover:bg-[#2d8500] text-white py-3 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando PIN...
                  </>
                ) : (
                  <>
                    VALIDAR PIN E INGRESAR
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                ¿Olvidaste o aún no tienes tu PIN? Escríbele por{" "}
                <strong className="text-sena-green">WhatsApp</strong> al
                Dinamizador TIC{" "}
                <strong className="text-sena-blue">
                  Ing. Deivis Andrés Sánchez H.
                </strong>{" "}
                o pasa por la <strong>Oficina de Sistemas</strong>.
              </p>

              <div className="flex items-center justify-end text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPinValue("");
                    setPinError("");
                    setViewState(otpReturnView);
                  }}
                  className="text-sena-blue font-semibold hover:underline cursor-pointer"
                >
                  Cambiar usuario
                </button>
              </div>
            </div>
          )}

          {/* --- VISTA 2.7: VIP SIN PIN ASIGNADO AÚN --- */}
          {viewState === "pin_pending" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
              <div className="rounded-2xl border-2 border-sena-green/30 bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/60 p-5 space-y-3.5 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sena-green text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sena-orange/15 text-sena-orange">
                      Activación PIN VIP Requerida
                    </span>
                    <h3 className="text-sm font-black text-sena-blue leading-snug mt-0.5">
                      ¡Hola, {pinTargetFullName}!
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {pinNoticeMessage ||
                    "Tu perfil cuenta con privilegios VIP / Coordinación y requiere un PIN numérico de 6 dígitos para resguardar tus permisos de autorización y gestión."}
                </p>

                <div className="rounded-xl bg-white border border-sena-blue/15 p-3.5 space-y-2.5 shadow-2xs">
                  <p className="text-[11px] font-black uppercase tracking-wider text-sena-blue">
                    ¿Cómo activar tu PIN ahora?
                  </p>
                  <p className="text-xs font-bold text-slate-800">
                    Dinamizador TIC:{" "}
                    <span className="text-sena-green">
                      Ing. Deivis Andrés Sánchez H.
                    </span>
                  </p>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-start gap-2">
                      <MessageCircle className="w-4 h-4 text-sena-green shrink-0 mt-0.5" />
                      <span>
                        Contáctalo por{" "}
                        <strong className="text-slate-800">WhatsApp</strong>{" "}
                        indicando tu nombre y usuario corporativo (
                        <strong>@{otpUsername}</strong>).
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-sena-orange shrink-0 mt-0.5" />
                      <span>
                        O dirígete directamente a la{" "}
                        <strong className="text-slate-800">
                          Oficina de Sistemas del Centro de Formación
                        </strong>{" "}
                        para validar tu identidad y asignártelo al instante.
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPinNoticeMessage("");
                  setViewState(otpReturnView);
                }}
                className="w-full bg-sena-blue hover:bg-blue-950 text-white py-3 rounded-lg font-bold shadow-md transition cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>
          )}

          {/* --- VISTA 2.8: AVISO RETIRO DE PRIVILEGIO VIP (YA NO REQUIERE PIN) --- */}
          {viewState === "pin_removed_notice" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
              <div className="rounded-2xl border-2 border-sena-green/35 bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 p-5 space-y-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sena-green text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sena-green/15 text-sena-green">
                      Actualización de Acceso
                    </span>
                    <h3 className="text-sm font-black text-sena-blue leading-snug mt-0.5">
                      ¡Hola, {pinTargetFullName}!
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  Te informamos que tus privilegios VIP han sido actualizados y{" "}
                  <strong className="text-sena-blue">
                    ya no requieres PIN de seguridad
                  </strong>{" "}
                  para ingresar a la plataforma.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A partir de ahora puedes acceder directamente con tu usuario
                  corporativo para gestionar tus reservas, prerreservas y
                  solicitudes de soporte técnico con total agilidad.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewState("request")}
                className="w-full bg-sena-green hover:bg-[#2d8500] text-white py-3 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                CONTINUAR AL PORTAL TIC
                <ArrowRight className="w-5 h-5" />
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
