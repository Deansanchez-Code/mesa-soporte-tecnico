import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useUserProfile } from "@/features/auth/hooks/useUserProfile";
import { useEffect, useState } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Roles permitidos para esta ruta
}

export default function AuthGuard({
  children,
  allowedRoles = [],
}: AuthGuardProps) {
  const router = useRouter();
  // Obtener 'role' del hook, que contiene la lógica correcta (metadata/profile)
  const { user, loading, role: userRole } = useUserProfile();
  const [storageBlocked] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const key = "__storage_test__";
        window.localStorage.setItem(key, key);
        window.localStorage.removeItem(key);
      }
      return false;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Si el storage está bloqueado, no redirigir todavía, mostrar error
        if (!storageBlocked) {
          router.push("/login");
        }
        return;
      }

      // Check Role
      // Usamos userRole que viene de useUserProfile (admin, agent, etc)
      // No user.role que suele ser 'authenticated'
      const currentRole = userRole || "";

      if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
        if (currentRole === "admin" || currentRole === "superadmin")
          router.push("/admin");
        else if (currentRole === "agent") router.push("/dashboard");
        else router.push("/login"); // Rol desconocido
      }
    }
  }, [user, loading, allowedRoles, router, storageBlocked, userRole]);

  if (storageBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800 p-4 text-center">
        <ShieldAlert className="w-16 h-16 mb-4 text-red-600" />
        <h1 className="text-2xl font-bold mb-2">
          Acceso Del Navegador Bloqueado
        </h1>
        <p className="max-w-md text-gray-600 mb-4">
          Tu navegador está bloqueando el acceso al almacenamiento local
          (Cookies/LocalStorage). Esto impide iniciar sesión correctamente.
        </p>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left text-sm space-y-2">
          <p className="font-bold">Posibles soluciones:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Desactiva el bloqueo de &quot;Cookies de terceros&quot;.</li>
            <li>Si usas modo Incógnito, permite cookies.</li>
            <li>Desactiva extensiones de privacidad agresivas.</li>
          </ul>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-sena-blue animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Verificando credenciales...</p>
      </div>
    );
  }

  const currentRole = userRole || "";

  // CASE 1: Unauthenticated - Show loader while redirecting (handled by useEffect)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-sena-blue animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Redirigiendo al inicio...</p>
      </div>
    );
  }

  // CASE 2: Authenticated but Forbidden
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-700">
        <ShieldAlert className="w-16 h-16 mb-4" />
        <h1 className="text-2xl font-bold">Acceso Restringido</h1>

        <div className="mt-4 text-sm text-red-600 text-center max-w-md">
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-bold transition-colors"
        >
          Ir a Iniciar Sesión
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
