"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { AlertTriangle, User, Users, Loader2 } from "lucide-react";

interface User {
  id: string;
  full_name?: string;
  area?: string;
  username?: string;
  role?: string;
}

interface PanicButtonModalProps {
  user: User;
  location: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function PanicButtonModal({
  user,
  location,
  onCancel,
  onSuccess,
}: PanicButtonModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMassReport = async () => {
    if (!location) {
      alert("Por favor selecciona una ubicación antes de reportar.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Insertamos el reporte individual (El "Voto")
      // El Trigger en la base de datos se encargará de contar si hay 3 o más
      const { error } = await supabase.from("outage_reports").insert({
        location: location,
        reported_by: user.id,
      });

      if (error) throw error;

      alert("✅ Reporte enviado. Estamos verificando si es una falla general.");
      onSuccess(); // Cierra el modal y notifica al padre
    } catch (error) {
      console.error("Error reportando falla:", error);
      alert("Error enviando el reporte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        {/* Cabecera de Advertencia */}
        <div className="bg-red-600 p-6 text-white text-center">
          <div className="bg-red-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-wide">
            Verificación Requerida
          </h2>
          <p className="text-red-100 text-sm mt-1">
            Estás a punto de reportar una falla masiva en{" "}
            <strong>{location || "tu ubicación"}</strong>.
          </p>
        </div>

        {/* Cuerpo del Mensaje */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-gray-800 font-bold text-lg">
              ¿Tus compañeros tampoco tienen internet?
            </p>
            <p className="text-gray-500 text-sm">
              Este reporte alertará inmediatamente a toda la Dirección TIC.
              Úsalo solo si confirmas que es un problema general.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Opción A: Solo soy yo (Cancelar) */}
            <button
              onClick={onCancel}
              className="group flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
            >
              <div className="bg-blue-100 p-3 rounded-full mr-4 group-hover:bg-blue-200 transition-colors">
                <User className="w-6 h-6 text-blue-700" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-800 group-hover:text-blue-700">
                  Solo soy yo
                </h3>
                <p className="text-xs text-gray-500">
                  Mi equipo falla, pero los demás tienen servicio.
                </p>
              </div>
            </button>

            {/* Opción B: Falla Masiva (Confirmar) */}
            <button
              onClick={handleMassReport}
              disabled={isSubmitting}
              className="group flex items-center p-4 border-2 border-red-50 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="bg-red-100 p-3 rounded-full mr-4 group-hover:bg-red-200 transition-colors">
                {isSubmitting ? (
                  <Loader2 className="w-6 h-6 text-red-700 animate-spin" />
                ) : (
                  <Users className="w-6 h-6 text-red-700" />
                )}
              </div>
              <div className="text-left">
                <h3 className="font-bold text-red-700">
                  Sí, es una Falla General
                </h3>
                <p className="text-xs text-red-900/60">
                  He verificado y nadie en esta sala tiene servicio.
                </p>
              </div>
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={onCancel}
              className="text-gray-400 text-sm hover:text-gray-600 underline cursor-pointer"
            >
              Cancelar y volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
