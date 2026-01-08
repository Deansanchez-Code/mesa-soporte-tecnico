import React, { useState } from "react";
import { MessageSquare, BookOpen } from "lucide-react";
import { Ticket } from "@/app/admin/admin.types";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import KnowledgeSearchModal from "@/features/knowledge/components/KnowledgeSearchModal";
import ArticleEditor, {
  Article,
} from "@/features/knowledge/components/ArticleEditor";

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

  // Knowledge Base State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showArticleEditor, setShowArticleEditor] = useState(false);
  const [saveToKb, setSaveToKb] = useState(false);

  const [draftArticle, setDraftArticle] = useState<Article | undefined>(
    undefined,
  );

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
      const finalComment = newComment;
      await onUpdateStatus(ticket.id, "RESUELTO");
      await onAddComment(ticket.id, finalComment);

      if (saveToKb) {
        // Prepare article draft
        setDraftArticle({
          title: `Solución: Ticket #${ticket.id}`,
          category:
            ticket.assets?.type === "Laptop" ||
            ticket.assets?.type === "Desktop"
              ? "Hardware"
              : "Otro",
          problem_type: "Problema reportado en ticket",
          solution: finalComment,
          file_urls: [],
        });
        setShowArticleEditor(true);
        // We do NOT call onSuccess yet, waiting for Article Save or Cancel
      } else {
        toast.success("Ticket resuelto exitosamente");
        onSuccess();
      }
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
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" /> Agregar
            Seguimiento
          </span>
          <button
            onClick={() => setShowSearchModal(true)}
            className="text-xs flex items-center gap-1.5 text-sena-green font-bold hover:underline bg-green-50 px-2 py-1 rounded-lg transition-colors border border-green-100"
            title="Buscar en Base de Conocimiento"
          >
            <BookOpen className="w-3.5 h-3.5" /> Buscar Solución
          </button>
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

      {/* Modal Buscador Soluciones */}
      {showSearchModal && (
        <KnowledgeSearchModal
          onClose={() => setShowSearchModal(false)}
          onSelect={(solution) => {
            setNewComment((prev) =>
              prev ? prev + "\n\n" + solution : solution,
            );
            toast.success("Solución copiada al comentario");
            setShowSearchModal(false);
          }}
        />
      )}

      {/* Modal Crear Articulo (Post-Resolución) */}
      {showArticleEditor && (
        <ArticleEditor
          article={draftArticle}
          onClose={() => {
            setShowArticleEditor(false);
            onSuccess(); // Close tickets modal finally
          }}
          onSaved={() => {
            setShowArticleEditor(false);
            toast.success("Ticket resuelto y solución guardada en KB");
            onSuccess();
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        onConfirm={confirmResolve}
        title="Resolver Ticket"
        // message="¿Estás seguro de que deseas marcar este ticket como RESUELTO? Asegúrate de haber agregado un comentario con la solución."
        message={
          <div className="space-y-4">
            <p>
              ¿Estás seguro de que deseas marcar este ticket como RESUELTO?
              Asegúrate de haber agregado un comentario con la solución.
            </p>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center h-5">
                <input
                  id="save-kb"
                  type="checkbox"
                  className="w-4 h-4 text-sena-green border-gray-300 rounded focus:ring-sena-green"
                  checked={saveToKb}
                  onChange={(e) => setSaveToKb(e.target.checked)}
                />
              </div>
              <label
                htmlFor="save-kb"
                className="text-sm text-gray-700 cursor-pointer select-none"
              >
                <span className="font-bold block text-gray-900">
                  Guardar como Solución en KB
                </span>
                <span className="text-xs text-gray-500">
                  Si marcas esto, se abrirá el editor para guardar esta
                  respuesta en la base de conocimiento.
                </span>
              </label>
            </div>
          </div>
        }
        confirmText="Sí, Resolver"
        variant="info"
        isLoading={submittingComment}
      />
    </>
  );
}
