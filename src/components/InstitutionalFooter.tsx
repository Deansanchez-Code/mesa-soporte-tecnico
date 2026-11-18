"use client";

import React, { useState } from "react";
import { ShieldCheck, Scale, Lock, FileCheck2 } from "lucide-react";
import { NativeDialog } from "@/components/ui/NativeDialog";

export default function InstitutionalFooter() {
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  return (
    <>
      <footer className="py-3.5 px-4 sm:px-6 border-t border-[var(--border-hairline)] bg-white/95 text-[11px] text-slate-500">
        <div className="max-w-[1640px] mx-auto flex flex-col gap-2">
          {/* Fila principal: Identidad Institucional + Autoría Ing. Deivis Andrés Sánchez H. - Dashdev.dev */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="tabular-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#043263] text-white">
                GOV·SENA·2026
              </span>
              <span className="font-semibold text-slate-600">
                Servicio Nacional de Aprendizaje SENA · Gestión de Ambientes
                Especiales y Reservas
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 text-slate-500">
              <span>Desarrollado por</span>
              <span className="font-bold text-[#043263]">
                Ing. Deivis Andrés Sánchez H.
              </span>
              <span className="text-slate-300">—</span>
              <a
                href="https://dashdev.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="tabular-mono font-bold text-[#39A900] hover:text-[#2d8500] hover:underline transition"
              >
                Dashdev.dev
              </a>
            </div>
          </div>

          {/* Fila sutil: Política de Autorización y Finalidad de Tratamiento de Datos Personales */}
          <div className="pt-1.5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-1.5 text-[10.5px] text-slate-400">
            <p className="text-center md:text-left leading-relaxed">
              <strong className="text-slate-500 font-semibold">
                Autorización de Tratamiento de Datos Personales (Ley 1581 de
                2012):
              </strong>{" "}
              El acceso y uso de esta plataforma implica la autorización para el
              tratamiento de sus datos institucionales con la finalidad
              exclusiva de gestionar reservas, asignaciones, control de acceso y
              trazabilidad de ambientes especiales del Centro de Formación.
            </p>
            <button
              type="button"
              onClick={() => setIsPolicyOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-[#043263]/80 hover:text-[#39A900] transition shrink-0 cursor-pointer underline decoration-slate-300 underline-offset-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#39A900]" />
              <span>Política y Finalidad de Datos</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Nativo <dialog> con la Política de Tratamiento y Finalidad de Datos Personales */}
      <NativeDialog
        isOpen={isPolicyOpen}
        onClose={() => setIsPolicyOpen(false)}
        title="Política de Tratamiento y Finalidad de Datos Personales"
        subtitle="Protección de Datos y Privacidad Institucional SENA"
        badgeText="LEY 1581 · 2012"
        headerIcon={<ShieldCheck className="w-5 h-5 text-emerald-300" />}
        maxWidthClass="max-w-2xl"
      >
        <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[70dvh] overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-start gap-3">
            <Scale className="w-5 h-5 text-[#043263] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[#043263]">
                01 / MARCO NORMATIVO Y AUTORIZACIÓN
              </p>
              <p className="leading-relaxed text-slate-600">
                En cumplimiento de la{" "}
                <strong>Ley Estatutaria 1581 de 2012</strong>, el{" "}
                <strong>Decreto Reglamentario 1377 de 2013</strong> (compilado
                en el Decreto Único 1074 de 2015), el{" "}
                <strong>Acuerdo SENA 0009 de 2016</strong> y los controles de
                seguridad de la información <strong>ISO/IEC 27001:2022</strong>,
                al autenticarse y registrar operaciones en esta plataforma el
                usuario autoriza de manera previa, expresa e informada el
                tratamiento de sus datos personales e institucionales.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-[#39A900] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-[#043263]">
                02 / FINALIDAD EXCLUSIVA DEL TRATAMIENTO
              </p>
              <p className="text-slate-600">
                Los datos recolectados (nombre completo, usuario o correo
                institucional/registrado, tipo de vinculación, área y registros
                de actividad) son utilizados única y exclusivamente para:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  <strong>Control de Acceso y Autenticación:</strong> Validar la
                  identidad de funcionarios de planta, instructores,
                  contratistas y coordinadores VIP mediante credenciales seguras
                  o PIN cifrado (<code className="tabular-mono">scrypt</code>).
                </li>
                <li>
                  <strong>Gestión de Ambientes Especiales y Reservas:</strong>{" "}
                  Programar, aprobar, asignar y consultar la disponibilidad de
                  espacios institucionales (Auditorio 103, Subdirección,
                  Biblioteca, Ambiente 107, Ambiente de Cocina y ambientes de
                  formación).
                </li>
                <li>
                  <strong>Comunicaciones Transaccionales:</strong> Enviar
                  notificaciones sobre confirmaciones, prerreservas pendientes
                  de autorización, recordatorios o novedades de mantenimiento de
                  ambientes.
                </li>
                <li>
                  <strong>Trazabilidad y Auditoría Institucional:</strong>{" "}
                  Garantizar el uso transparente de la infraestructura física
                  del Centro Agroempresarial y Desarrollo Pecuario del Huila —
                  SENA.
                </li>
              </ul>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#FC7323] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[#043263]">
                03 / DERECHOS DEL TITULAR (HABEAS DATA) Y CONFIDENCIALIDAD
              </p>
              <p className="leading-relaxed text-slate-600">
                El titular de los datos tiene derecho en todo momento a conocer,
                actualizar, rectificar y solicitar la actualización de su
                información ante la administración del sistema o el{" "}
                <strong>Dinamizador TIC del Centro de Formación</strong>. La
                información se encuentra protegida mediante políticas Row Level
                Security (RLS) y bajo ninguna circunstancia es cedida,
                compartida ni comercializada con terceros externos.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            Arquitectura &amp; Desarrollo:{" "}
            <strong className="text-[#043263]">
              Ing. Deivis Andrés Sánchez H. — Dashdev.dev
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setIsPolicyOpen(false)}
            className="min-h-[40px] px-4 py-1.5 rounded-lg bg-[#39A900] hover:bg-[#2d8500] text-white text-xs font-bold transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </NativeDialog>
    </>
  );
}
