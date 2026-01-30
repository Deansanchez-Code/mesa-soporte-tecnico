import { useState } from "react";
import {
  CheckCircle,
  Power,
  ArrowLeft,
  Paperclip,
  Loader2,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase/cliente";
import { toast } from "sonner";
import KnowledgeSearchModal from "@/features/knowledge/components/KnowledgeSearchModal";
import ArticleEditor, {
  Article,
} from "@/features/knowledge/components/ArticleEditor";
import { Ticket } from "@/app/admin/admin.types";

interface ResolutionModalProps {
  resolvingTicketId: number | null;
  ticket?: Ticket | null; // Added
  onClose: () => void;
  solutionTexts: Record<number, string>;
  setSolutionTexts: (texts: Record<number, string>) => void;
  onUpdateStatus: (ticketId: number, status: string) => Promise<void>;
}

export default function ResolutionModal({
  resolvingTicketId,
  ticket,
  onClose,
  solutionTexts,
  setSolutionTexts,
  onUpdateStatus,
}: ResolutionModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showArticleEditor, setShowArticleEditor] = useState(false);
  const [saveToKb, setSaveToKb] = useState(false);
  const [draftArticle, setDraftArticle] = useState<Article | undefined>(
    undefined,
  );

  if (!resolvingTicketId) return null;

  const currentText = solutionTexts[resolvingTicketId] || "";
  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  const wordCountColor = wordCount < 20 ? "text-red-500" : "text-green-600";
  const isValid = wordCount >= 20;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${resolvingTicketId}_evidence_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket_evidence")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("ticket_evidence")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Concatenar al texto actual
      const newText = currentText
        ? `${currentText}\n\n[EVIDENCIA]: ${publicUrl}`
        : `[EVIDENCIA]: ${publicUrl}`;

      setSolutionTexts({
        ...solutionTexts,
        [resolvingTicketId]: newText,
      });

      toast.success("Soporte adjuntado correctamente");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error al subir el archivo");
    } finally {
      setIsUploading(false);
      // Reset input value to allow selecting same file again if needed
      e.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-green-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Resolver Ticket</h2>
              <p className="text-xs text-green-100">
                #{resolvingTicketId} - Detalla la solución definitiva
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Power className="w-5 h-5 rotate-90" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <p className="text-sm text-yellow-800">
              <strong>Importante:</strong> Debes detallar los pasos técnicos
              realizados. Mínimo 20 palabras para asegurar la calidad del
              repositorio.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-700">
                Solución Técnica
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="text-xs flex items-center gap-1.5 text-sena-green font-bold hover:bg-green-50 px-2 py-1 rounded-lg transition-colors border border-green-200 bg-white"
                  title="Buscar en base de conocimiento"
                >
                  <Search className="w-3.5 h-3.5" /> Buscar Solución
                </button>
                <input
                  type="file"
                  id="evidence-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <label
                  htmlFor="evidence-upload"
                  className={`text-xs flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg border transition-all ${
                    isUploading
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-wait"
                      : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 font-bold"
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5" />
                  )}
                  {isUploading ? "Subiendo..." : "Adjuntar Soporte"}
                </label>
              </div>
            </div>
            <textarea
              className="w-full border-2 border-gray-100 rounded-xl p-4 min-h-[180px] outline-none focus:border-green-500 transition-all resize-none text-gray-700 placeholder:text-gray-400"
              placeholder="Describe qué hiciste para solucionar el problema..."
              value={currentText}
              onChange={(e) =>
                setSolutionTexts({
                  ...solutionTexts,
                  [resolvingTicketId]: e.target.value,
                })
              }
            />
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span className={wordCountColor}>Palabras: {wordCount} / 20</span>
              <span className="text-gray-400 italic">
                Auto-guardado habilitado
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center h-5">
              <input
                id="save-kb-res"
                type="checkbox"
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                checked={saveToKb}
                onChange={(e) => setSaveToKb(e.target.checked)}
              />
            </div>
            <label
              htmlFor="save-kb-res"
              className="text-xs text-gray-700 cursor-pointer select-none"
            >
              <span className="font-bold block text-gray-900">
                Guardar solución en el repositorio
              </span>
              <span className="text-gray-500">
                Ayuda a otros agentes guardando esta solución en la base de
                conocimiento.
              </span>
            </label>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a la bandeja
            </button>
            <button
              disabled={!isValid}
              onClick={async () => {
                await onUpdateStatus(resolvingTicketId, "RESUELTO");
                if (saveToKb) {
                  setDraftArticle({
                    title: `Solución: Ticket #${resolvingTicketId}`,
                    category:
                      ticket?.category?.includes("HW") ||
                      ticket?.category?.toUpperCase().includes("HARDWARE")
                        ? "Hardware"
                        : ticket?.category
                              ?.toUpperCase()
                              .includes("SOFTWARE") ||
                            ticket?.category?.includes("SOFT")
                          ? "Software"
                          : "Otro",
                    problem_type: "Incidencia/Requerimiento",
                    solution: currentText,
                    file_urls: [],
                  });
                  setShowArticleEditor(true);
                } else {
                  onClose();
                }
              }}
              className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                !isValid
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 hover:scale-[1.02]"
              }`}
            >
              Confirmar Solución
              <CheckCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showSearchModal && (
        <KnowledgeSearchModal
          onClose={() => setShowSearchModal(false)}
          onSelect={(solution) => {
            const newText = currentText
              ? currentText + "\n\n" + solution
              : solution;
            setSolutionTexts({
              ...solutionTexts,
              [resolvingTicketId]: newText,
            });
            toast.success("Solución copiada al detalle");
            setShowSearchModal(false);
          }}
        />
      )}

      {showArticleEditor && (
        <ArticleEditor
          article={draftArticle}
          onClose={() => {
            setShowArticleEditor(false);
            onClose();
          }}
          onSaved={() => {
            setShowArticleEditor(false);
            toast.success("Solución guardada en el repositorio");
            onClose();
          }}
        />
      )}
    </div>
  );
}
