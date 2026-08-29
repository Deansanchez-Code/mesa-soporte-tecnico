"use client";

import React from "react";
import { AlertTriangle, CalendarX, Info, PhoneCall, X } from "lucide-react";
import { SpaceMaintenanceConfig } from "../types";

interface AuditoriumMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SpaceMaintenanceConfig;
}

export default function AuditoriumMaintenanceModal({
  isOpen,
  onClose,
  config,
}: AuditoriumMaintenanceModalProps) {
  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formattedStart = formatDate(config.start_date);
  const formattedEnd = config.end_date ? formatDate(config.end_date) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-amber-200 animate-in zoom-in-95 duration-200">
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black tracking-tight uppercase">
            Aviso de Remodelación
          </h3>
          <p className="text-xs text-amber-100 font-semibold tracking-wider mt-0.5">
            Auditorio Principal Fuera de Servicio
          </p>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-4 text-slate-700">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <CalendarX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Estimado(a) funcionario(a) o usuario(a):
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Le informamos que a partir del{" "}
                  <strong className="text-amber-800 underline">
                    {formattedStart}
                  </strong>
                  , el auditorio entrará en proceso de{" "}
                  <strong>obras de remodelación y adecuación física</strong>.
                </p>
              </div>
            </div>

            <div className="border-t border-amber-200/60 pt-2.5 mt-2">
              <span className="text-[11px] font-bold text-amber-900 block">
                Disponibilidad de Reservas:
              </span>
              {formattedEnd ? (
                <p className="text-xs text-slate-700 mt-0.5">
                  🗓️ Fecha estimada de habilitación:{" "}
                  <strong className="text-amber-900">{formattedEnd}</strong>.
                  (Las reservas para fechas intermedias quedan suspendidas).
                </p>
              ) : (
                <p className="text-xs text-slate-700 mt-0.5 font-medium">
                  🚫 <strong>No se habilitarán reservas</strong> por el resto de
                  la vigencia <strong>2026</strong>.
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Ofrecemos sinceras disculpas por los inconvenientes que esto pueda
              generar en la programación de sus actividades académicas o
              eventos.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <PhoneCall className="w-5 h-5 text-sena-blue shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 font-semibold leading-relaxed">
              Para organización de eventos prioritarios o reuniones especiales,
              por favor remitirse directamente con la{" "}
              <span className="underline">
                Coordinación Académica o de Formación
              </span>
              .
            </p>
          </div>

          {/* Botón de acción */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-900/10 transition-all cursor-pointer text-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
