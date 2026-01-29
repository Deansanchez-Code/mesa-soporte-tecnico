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
  const isPaused = ticket.sla_status === "paused";
  const slaHours = getSLAHours(ticket);
  const created = ticket.created_at || new Date().toISOString();

  // Use stored expected end if available, otherwise calculate
  const dueDate = ticket.sla_expected_end_at
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
            CONGELADO
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
              ? `Congelado - Falta ${formatDistanceToNow(dueDate, { locale: es })}`
              : isOverdue
                ? `Vencido hace ${formatDistanceToNow(dueDate, { locale: es })}`
                : `Vence en ${formatDistanceToNow(dueDate, { locale: es })}`}
        </span>
      </div>
    </div>
  );
}
