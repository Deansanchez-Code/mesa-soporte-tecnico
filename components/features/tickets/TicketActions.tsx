import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Ticket } from "@/app/admin/types";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

interface TicketActionsProps {
  ticket: Ticket;
  onAddComment?: (ticketId: number, comment: string) => Promise<void>;
  onUpdateStatus?: (ticketId: number, status: string) => Promise<void>;
  onCommentAdded: () => Promise<void>; // To refresh events
  onSuccess: () => void; // To close modal if resolved
}

export function TicketActions({
  ticket,
  onAddComment,
  onUpdateStatus,
  onCommentAdded,
  onSuccess,
}: TicketActionsProps) {
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);

  const handleSendComment = async () => {
    if (!newComment.trim() || !onAddComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(ticket.id, newComment);
      setNewComment("");
      toast.success("Comentario agregado");
      await onCommentAdded();
    } catch (e) {
      console.error("Error sending comment:", e);
      toast.error("Error al enviar comentario");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleResolveClick = () => {
    if (!newComment.trim()) {
      return toast.warning("Escribe una solución/comentario para resolver.");
    }
    setShowResolveDialog(true);
  };

  const confirmResolve = async () => {
    if (!onUpdateStatus || !onAddComment) return;
    setSubmittingComment(true);
    try {
      await onUpdateStatus(ticket.id, "RESUELTO");
      await onAddComment(ticket.id, newComment);
      toast.success("Ticket resuelto exitosamente");
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error("Error al resolver ticket");
    } finally {
      setSubmittingComment(false);
      setShowResolveDialog(false);
    }
  };

  if (!onAddComment) return null;

  return (
    <>
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500" /> Agregar
          Seguimiento
        </h3>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          rows={3}
          placeholder="Escribe un comentario..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <div className="flex justify-end mt-2 gap-2">
          {onUpdateStatus &&
            ticket.status !== "RESUELTO" &&
            ticket.status !== "CERRADO" && (
              <button
                onClick={handleResolveClick}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold"
                disabled={submittingComment}
              >
                Resolver
              </button>
            )}
          <button
            onClick={handleSendComment}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold disabled:opacity-50"
            disabled={submittingComment || !newComment.trim()}
          >
            {submittingComment ? "Enviando..." : "Enviar Comentario"}
          </button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        onConfirm={confirmResolve}
        title="Resolver Ticket"
        message="¿Estás seguro de que deseas marcar este ticket como RESUELTO? Asegúrate de haber agregado un comentario con la solución."
        confirmText="Sí, Resolver"
        variant="info"
        isLoading={submittingComment}
      />
    </>
  );
}
