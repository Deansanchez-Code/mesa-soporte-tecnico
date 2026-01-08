"use client";

import { useState, useRef } from "react";
import { X, Upload, FileText, Save, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

export interface Article {
  id?: string;
  title: string;
  category: "Hardware" | "Software" | "Otro";
  problem_type: string;
  solution: string;
  file_urls: string[];
}

interface ArticleEditorProps {
  article?: Article; // If present, we are editing
  onClose: () => void;
  onSaved: () => void;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function ArticleEditor({
  article,
  onClose,
  onSaved,
}: ArticleEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Article>({
    title: article?.title || "",
    category: article?.category || "Hardware",
    problem_type: article?.problem_type || "",
    solution: article?.solution || "",
    file_urls: article?.file_urls || [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isUploading) return;

    try {
      setIsSubmitting(true);
      const url = article?.id
        ? `/api/knowledge/${article.id}`
        : "/api/knowledge";
      const method = article?.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Error al guardar");

      toast.success(
        article?.id ? "Solución actualizada" : "Solución creada con éxito",
      );
      onSaved();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Ocurrió un error al guardar los cambios");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const uploadedUrls: string[] = [...formData.file_urls];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== "application/pdf") {
          toast.warning(`El archivo ${file.name} no es un PDF y será ignorado`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `kb/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("kb_documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("kb_documents").getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setFormData({ ...formData, file_urls: uploadedUrls });
      toast.success("Archivos subidos correctamente");
    } catch (error: unknown) {
      console.error(error);
      toast.error("Error al subir archivos");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...formData.file_urls];
    newFiles.splice(index, 1);
    setFormData({ ...formData, file_urls: newFiles });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {article?.id ? "Editar Solución" : "Nueva Solución Técnica"}
            </h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5">
              Repositorio de Soporte
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <form id="kb-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                  Título de la Solución
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Error de impresión en HP Laserjet..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sena-green outline-none"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                  Categoría
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sena-green outline-none"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as Article["category"],
                    })
                  }
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Software">Software</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Tipo de Problema
              </label>
              <input
                required
                type="text"
                placeholder="Ej: Impresora, Red local, Software específico..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sena-green outline-none"
                value={formData.problem_type}
                onChange={(e) =>
                  setFormData({ ...formData, problem_type: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Solución Detallada
              </label>
              <textarea
                required
                rows={6}
                placeholder="Describe los pasos para resolver el problema..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sena-green outline-none resize-none"
                value={formData.solution}
                onChange={(e) =>
                  setFormData({ ...formData, solution: e.target.value })
                }
              />
            </div>

            {/* File Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Manuales y Documentos (PDF)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50/30 hover:bg-gray-50 hover:border-sena-green/40 transition-all cursor-pointer group"
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-sena-green animate-spin mb-2" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-300 mb-2 group-hover:text-sena-green transition-colors" />
                )}
                <p className="text-sm font-semibold text-gray-600">
                  {isUploading
                    ? "Subiendo archivos..."
                    : "Haz clic para subir PDFs"}
                </p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">
                  Máximo 10MB por archivo
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>

              {/* Uploaded Files List */}
              {formData.file_urls.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {formData.file_urls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl group/file"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 text-red-500 rounded-lg">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 truncate max-w-[300px]">
                          Manual_Adjunto_{index + 1}.pdf
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            form="kb-form"
            type="submit"
            disabled={isSubmitting || isUploading}
            className="px-8 py-2.5 bg-sena-green hover:bg-[#2d8500] text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {article?.id ? "Actualizar" : "Publicar Solución"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
