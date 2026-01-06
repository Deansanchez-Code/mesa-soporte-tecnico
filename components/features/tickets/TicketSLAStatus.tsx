import React from "react";
import { Clock } from "lucide-react";
import { Ticket } from "@/app/admin/types";
import { formatDistanceToNow, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import {
  calculateSLADueDate,
  getSLAHours,
} from "@/lib/dominio/calculadora-sla";

interface TicketSLAStatusProps {
  ticket: Ticket;
}

export function TicketSLAStatus({ ticket }: TicketSLAStatusProps) {
  const slaHours = getSLAHours(ticket);
  const created = ticket.created_at || new Date().toISOString();
  const dueDate = calculateSLADueDate(created, slaHours);
  const isOverdue = !isAfter(dueDate, new Date());
  const isResolved =
    ticket.status === "RESUELTO" || ticket.status === "CERRADO";

  return (
    <div
      className={`mb-4 p-4 rounded-lg border shadow-sm ${
        isOverdue && !isResolved
          ? "bg-red-50 border-red-200"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <h3
        className={`text-xs font-bold uppercase mb-2 flex items-center gap-2 ${
          isOverdue ? "text-red-600" : "text-blue-600"
        }`}
      >
        <Clock className="w-3.5 h-3.5" /> Est. Vencimiento ({slaHours}h)
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
            isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
          }`}
        >
          {isResolved
            ? "Completado"
            : isOverdue
              ? `Vencido hace ${formatDistanceToNow(dueDate, { locale: es })}`
              : `Vence en ${formatDistanceToNow(dueDate, { locale: es })}`}
        </span>
      </div>
    </div>
  );
}
