"use client";

import { CheckCircle, Power, ArrowLeft } from "lucide-react";

interface ResolutionModalProps {
  resolvingTicketId: number | null;
  onClose: () => void;
  solutionTexts: Record<number, string>;
  setSolutionTexts: (texts: Record<number, string>) => void;
  onUpdateStatus: (ticketId: number, status: string) => Promise<void>;
}

export default function ResolutionModal({
  resolvingTicketId,
  onClose,
  solutionTexts,
  setSolutionTexts,
  onUpdateStatus,
}: ResolutionModalProps) {
  if (!resolvingTicketId) return null;

  const currentText = solutionTexts[resolvingTicketId] || "";
  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  const wordCountColor = wordCount < 20 ? "text-red-500" : "text-green-600";
  const isValid = wordCount >= 20;

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
            <label className="text-sm font-bold text-gray-700">
              Solución Técnica
            </label>
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

          <div className="flex gap-4 pt-4">
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
                onClose();
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
    </div>
  );
}
