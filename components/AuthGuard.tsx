"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeGetItem, safeRemoveItem } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldAlert } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Roles permitidos para esta ruta
}

export default function AuthGuard({
  children,
  allowedRoles = [],
}: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Verificar sesión real de Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Si no hay sesión, borrar rastro local y redirigir
        safeRemoveItem("tic_user");
        router.push("/login");
        return;
      }

      // 2. Verificar datos locales (Rol)
      // Idealmente, deberíamos traer el rol desde la DB usando session.user.id
      // Pero por ahora confiamos en localStorage para evitar latencia,
      // asumiendo que RLS bloqueará peticiones si el rol es falso.
      const userStr = safeGetItem("tic_user");

      if (!userStr) {
        // Sesión válida pero sin datos locales -> Forzar relogin para sincronizar
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      try {
        const user = JSON.parse(userStr);

        // 3. Verificar si el usuario tiene un rol permitido
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
          // Si es admin intentando entrar a dashboard de agente, o viceversa
          if (user.role === "admin") router.push("/admin");
          else if (user.role === "agent") router.push("/dashboard");
          else router.push("/login"); // Rol desconocido
          return;
        }

        // Si pasa todas las verificaciones
        setAuthorized(true);
      } catch (e) {
        console.error("Error parseando usuario:", e);
        safeRemoveItem("tic_user");
        await supabase.auth.signOut();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-sena-blue animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Verificando credenciales...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-700">
        <ShieldAlert className="w-16 h-16 mb-4" />
        <h1 className="text-2xl font-bold">Acceso Restringido</h1>
      </div>
    );
  }

  return <>{children}</>;
}
