import React from "react";
import { Monitor, User, MapPin } from "lucide-react";
import { Ticket } from "@/app/admin/admin.types";
import { TicketSLAStatus } from "./TicketSLAStatus";

interface TicketInfoSidebarProps {
  ticket: Ticket;
}

export const TicketInfoSidebar = ({ ticket }: TicketInfoSidebarProps) => {
  return (
    <div className="space-y-4">
      {/* Asset Info */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5" /> Equipo Afectado
        </h3>

        {/* SLA Info */}
        <TicketSLAStatus ticket={ticket} />

        {ticket.assets ? (
          <div>
            <p className="font-bold text-gray-800 text-sm">
              {ticket.assets.type}
            </p>
            <p className="text-xs text-gray-600">{ticket.assets.model}</p>
            <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded block w-fit mt-1 text-gray-500">
              {ticket.assets.serial_number}
            </code>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No especificado</p>
        )}
      </div>

      {/* User Info */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
          <User className="w-3.5 h-3.5" /> Solicitante
        </h3>
        <p className="font-bold text-gray-800 text-sm">
          {ticket.users?.full_name}
        </p>
        <p className="text-xs text-gray-600 mb-2">{ticket.users?.area}</p>
        <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 w-fit px-2 py-0.5 rounded">
          <MapPin className="w-3 h-3" /> {ticket.location}
        </div>
      </div>
    </div>
  );
};
