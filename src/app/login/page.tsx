"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";
import { safeSetItem } from "@/lib/storage";
import {
  Lock,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // ESTRATEGIA EMAIL INVISIBLE MEJORADA:
      // Si el usuario ingresa un email completo (con @), lo usamos.
      // Si ingresa solo usuario (ej: "jperez"), agregamos "@sistema.local".
      const inputUsername = formData.username.trim().toLowerCase();
      const syntheticEmail = inputUsername.includes("@")
        ? inputUsername
        : `${inputUsername}@sistema.local`;

      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: syntheticEmail,
          password: formData.password,
        },
      );

      if (authError) {
        console.error("Login error:", authError);
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error("Credenciales inválidas");
        } else {
          // Assume blocked/banned if not credentials (or specific banned error)
          throw new Error(
            "Acceso denegado por temas contractuales o no te has registrado en la plataforma.",
          );
        }
      }

      const user = data.user;
      if (!user) throw new Error("Error de sesión");

      // 4. Guardar sesión (localStorage simple para compatibilidad con código legacy)
      // Aunque Supabase ya maneja la sesión, mantenemos esto por ahora para no romper AuthGuard viejo
      // Idealmente, AuthGuard debería migrarse a usar supabase.auth.getSession()

      // Buscamos el rol en la tabla pública (ya que auth.users no tiene rol por defecto a menos que usemos custom claims)
      const { data: publicUser } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (publicUser) {
        safeSetItem("tic_user", JSON.stringify(publicUser));

        // 5. Redirigir según rol
        if (publicUser.role === "admin" || publicUser.role === "superadmin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      } else {
        // Fallback si no se ha migrado la tabla pública aún
        throw new Error("Usuario no sincronizado. Contacte soporte.");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sena-blue flex flex-col items-center justify-center p-4">
      {/* Botón Volver */}
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="text-white/70 hover:text-white flex items-center gap-2 text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Inicio
        </Link>
      </div>

      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="bg-sena-green w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Acceso TIC</h1>
          <p className="text-sm text-gray-500">
            Mesa de Ayuda y Administración
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Usuario
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-sena-green transition"
              placeholder="Usuario corporativo"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                className="w-full border border-gray-300 rounded-lg p-3 pl-10 outline-none focus:ring-2 focus:ring-sena-green transition"
                placeholder="••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sena-blue hover:bg-blue-900 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "INGRESAR AL SISTEMA"
            )}
          </button>
        </form>
      </div>

      <p className="text-white/40 text-xs mt-8">
        Sistema de Gestión de Soporte V1.0
      </p>
    </div>
  );
}
