import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Roles permitidos para esta ruta
}

export default function AuthGuard({
  children,
  allowedRoles = [],
}: AuthGuardProps) {
  const router = useRouter();
  const { user, loading } = useUserProfile();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
        return;
      }

      // Check Role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        if (user.role === "admin" || user.role === "superadmin")
          router.push("/admin");
        else if (user.role === "agent") router.push("/dashboard");
        else router.push("/login"); // Rol desconocido
      }
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-sena-blue animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Verificando credenciales...</p>
      </div>
    );
  }

  if (!user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-700">
        <ShieldAlert className="w-16 h-16 mb-4" />
        <h1 className="text-2xl font-bold">Acceso Restringido</h1>
      </div>
    );
  }

  return <>{children}</>;
}
