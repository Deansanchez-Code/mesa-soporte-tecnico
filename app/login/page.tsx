"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
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
      // 1. Buscar usuario
      const { data: user, error: dbError } = await supabase
        .from("users")
        .select("*")
        .eq("username", formData.username.toLowerCase().trim())
        .single();

      if (dbError || !user) {
        throw new Error("Credenciales inválidas");
      }

      // 2. Validar contraseña (Comparación simple para MVP)
      // En producción esto debería usar bcrypt o Supabase Auth
      if (user.password !== formData.password) {
        throw new Error("Contraseña incorrecta");
      }

      // 3. Validar Rol
      if (user.role !== "agent" && user.role !== "admin") {
        throw new Error("No tienes permisos de acceso administrativo.");
      }

      // 4. Guardar sesión (localStorage simple para MVP)
      // Esto servirá para nuestro Middleware básico después
      safeSetItem("tic_user", JSON.stringify(user));

      // 5. Redirigir según rol
      if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
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
