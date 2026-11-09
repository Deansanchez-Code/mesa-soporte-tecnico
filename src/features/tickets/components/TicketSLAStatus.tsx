import React from "react";
import { Clock, PauseCircle } from "lucide-react";
import { Ticket } from "@/app/admin/admin.types";
import { formatDistanceToNow, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { calculateSLADueDate, getSLAHours } from "@/lib/domain/sla-calculator";

interface TicketSLAStatusProps {
  ticket: Ticket;
}

export function TicketSLAStatus({ ticket }: TicketSLAStatusProps) {
  // Parsing logic for auditorium/reservation date
  const getAuditoriumDate = (t: Ticket) => {
    const cat = t.category?.toLowerCase() || "";
    if (!cat.includes("auditorio") && !cat.includes("reserva")) return null;
    const desc = t.description || "";
    const dateMatch = desc.match(/Fecha[s]?:\s*(\d{2,4}[-/]\d{2}[-/]\d{2,4})/i);
    const timeMatch = desc.match(/Hora:\s*(\d{2}:\d{2})/i);
    if (dateMatch && timeMatch) {
      const dateStr = dateMatch[1].replace(/\//g, "-");
      const [p1, p2, p3] = dateStr.split("-");
      const normalizedDate =
        p1.length === 4 ? `${p1}-${p2}-${p3}` : `${p3}-${p2}-${p1}`;
      return new Date(`${normalizedDate}T${timeMatch[1]}`);
    }
    return null;
  };

  const eventDate = getAuditoriumDate(ticket);
  const now = new Date();
  const isFutureAuditorium = Boolean(
    eventDate && (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60) >= 24,
  );

  const isPaused = ticket.sla_status === "paused" || isFutureAuditorium;
  const slaHours = getSLAHours(ticket);
  const created = ticket.created_at || new Date().toISOString();

  // Para reservas agendadas en espera, la fecha objetivo es el inicio del evento
  const dueDate =
    isFutureAuditorium && eventDate
      ? eventDate
      : ticket.sla_expected_end_at
        ? new Date(ticket.sla_expected_end_at)
        : calculateSLADueDate(created, slaHours);

  const isOverdue = !isAfter(dueDate, new Date());
  const isResolved =
    ticket.status === "RESUELTO" || ticket.status === "CERRADO";

  return (
    <div
      className={`mb-4 p-4 rounded-lg border shadow-sm transition-colors ${
        isPaused
          ? "bg-purple-50 border-purple-200"
          : isOverdue && !isResolved
            ? "bg-red-50 border-red-200"
            : "bg-gray-50 border-gray-200"
      }`}
    >
      <h3
        className={`text-xs font-bold uppercase mb-2 flex items-center justify-between ${
          isPaused
            ? "text-purple-600"
            : isOverdue
              ? "text-red-600"
              : "text-blue-600"
        }`}
      >
        <span className="flex items-center gap-2">
          {isPaused ? (
            <PauseCircle className="w-3.5 h-3.5" />
          ) : (
            <Clock className="w-3.5 h-3.5" />
          )}
          Est. Vencimiento ({slaHours}h)
        </span>
        {isPaused && (
          <span className="bg-purple-600 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">
            {isFutureAuditorium ? "ESPERA AGENDADA" : "CONGELADO"}
          </span>
        )}
      </h3>

      <p className="font-bold text-gray-800 text-sm mb-2 capitalize">
        {dueDate.toLocaleString("es-CO", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-bold px-2 py-1 rounded ${
            isPaused
              ? "bg-purple-100 text-purple-700"
              : isOverdue
                ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {isResolved
            ? "Completado"
            : isPaused
              ? isFutureAuditorium
                ? "En espera de activación (24h antes)"
                : `Congelado - Falta ${formatDistanceToNow(dueDate, { locale: es })}`
              : isOverdue
                ? `Vencido hace ${formatDistanceToNow(dueDate, { locale: es })}`
                : `Vence en ${formatDistanceToNow(dueDate, { locale: es })}`}
        </span>
      </div>
    </div>
  );
}
