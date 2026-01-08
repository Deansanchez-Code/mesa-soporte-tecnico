"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { Ticket } from "@/app/admin/types";
import { useTicketDetails } from "../hooks/useTicketDetails";
import { TicketHeader } from "./TicketHeader";
import { TicketTimeline } from "./TicketTimeline";
import { TicketActions } from "./TicketActions";
import { TicketInfoSidebar } from "./TicketInfoSidebar";
import { TicketAssigner } from "./TicketAssigner";

interface TicketDetailsModalProps {
  ticket: Ticket;
  agents?: { id: string; full_name: string; role: string }[];
  onAssign?: (ticketId: number, agentId: string) => Promise<void>;
  onAddComment?: (ticketId: number, comment: string) => Promise<void>;
  onUpdateStatus?: (ticketId: number, status: string) => Promise<void>;
  currentUser?: { id: string; full_name: string };
  onClose: () => void;
}

export default function TicketDetailsModal({
  ticket,
  onClose,
  agents = [],
  onAssign,
  onAddComment,
  onUpdateStatus,
  currentUser,
}: TicketDetailsModalProps) {
  // --- Business Logic Hook ---
  const {
    loadingEvents,
    pauseReasons,
    processingAction,
    timelineItems,
    handlePause,
    handleResume,
    refreshEvents,
  } = useTicketDetails({
    ticket,
    currentUser,
    onSuccess: onClose, // Close modal after status change
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
        <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 border border-gray-200">
          <TicketHeader
            ticket={ticket}
            onClose={onClose}
            onResume={handleResume}
            onPause={handlePause}
            processingAction={processingAction}
            pauseReasons={pauseReasons}
          />

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* LEFT COLUMN: Details */}
              <div className="md:col-span-1 space-y-4">
                <TicketInfoSidebar ticket={ticket} />

                {/* Agent Assignment */}
                <TicketAssigner
                  ticket={ticket}
                  agents={agents}
                  onAssign={onAssign}
                  onClose={onClose}
                />
              </div>

              {/* RIGHT COLUMN: Description & Audit */}
              <div className="md:col-span-2 space-y-4">
                {/* Description */}
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />{" "}
                    Descripción del Problema
                  </h3>
                  <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 border border-gray-100 leading-relaxed whitespace-pre-wrap">
                    {ticket.description?.split("\n\n[")[0] || "Sin descripción"}
                  </div>
                </div>

                {/* Add Comment Section */}
                <TicketActions
                  ticket={ticket}
                  onAddComment={onAddComment}
                  onUpdateStatus={onUpdateStatus}
                  onCommentAdded={refreshEvents}
                  onSuccess={onClose}
                />

                {/* Audit Log / Timeline */}
                <TicketTimeline
                  loadingEvents={loadingEvents}
                  timelineItems={timelineItems}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
