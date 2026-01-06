"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Edit,
  Trash2,
  FileText,
  Download,
  Clock,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import ArticleEditor from "@/components/features/knowledge/ArticleEditor";

interface Article {
  id: string;
  title: string;
  category: "Hardware" | "Software" | "Otro";
  problem_type: string;
  solution: string;
  file_urls: string[];
  created_at: string;
  updated_at: string;
  created_by_user?: {
    full_name: string;
  };
}

export default function ArticleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchArticle = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/knowledge/${params.id}`);
      if (!response.ok) throw new Error("Error fetching article");
      const data = await response.json();
      setArticle(data);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar el artículo");
      router.push("/dashboard/knowledge");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar esta solución del repositorio?",
      )
    )
      return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/knowledge/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error deleting");

      toast.success("Solución eliminada correctamente");
      router.push("/dashboard/knowledge");
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar la solución");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-sena-green animate-spin" />
        <p className="text-gray-500 font-medium">Cargando detalles...</p>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <button
          onClick={() => router.push("/dashboard/knowledge")}
          className="flex items-center gap-3 text-gray-500 hover:text-sena-green font-bold transition-all group"
        >
          <div className="bg-white p-2.5 rounded-2xl group-hover:bg-sena-green/10 shadow-sm border border-gray-100 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Repositorio
            </span>
            <span className="text-lg">Volver al listado</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-2xl border border-gray-100 shadow-sm transition-all font-bold text-sm"
          >
            <Edit className="w-5 h-5" />
            Editar Solución
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-2xl border border-gray-100 shadow-sm transition-all font-bold text-sm"
          >
            {isDeleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
            Eliminar
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Solution Detail */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-500 relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-sena-green/5 rounded-bl-[5rem] -mr-8 -mt-8" />

            <div className="relative space-y-8">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.1em] shadow-sm ${
                      article.category === "Hardware"
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                        : article.category === "Software"
                          ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
                          : "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                    }`}
                  >
                    {article.category}
                  </span>
                  <span className="px-4 py-1.5 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.1em] ring-1 ring-gray-100 shadow-sm">
                    {article.problem_type}
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-[1.15] tracking-tight">
                  {article.title}
                </h1>
              </div>

              <div className="pt-10 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-sena-green/10 p-2 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-sena-green" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Solución Técnica
                  </h2>
                </div>
                <div className="bg-gray-50/70 p-8 rounded-[2rem] border border-gray-100/50 text-gray-700 leading-relaxed font-medium text-lg whitespace-pre-wrap shadow-inner">
                  {article.solution}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Metadata & Files */}
        <div className="space-y-8">
          {/* Metadata Card */}
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-8">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="h-px bg-gray-100 flex-1" />
              Detalles
              <div className="h-px bg-gray-100 flex-1" />
            </h3>

            <div className="space-y-6">
              <div className="flex items-center gap-5 group">
                <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-sena-green/10 group-hover:text-sena-green transition-colors duration-300">
                  <User className="w-5 h-5 text-gray-400 group-hover:text-current" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                    Autor de la solución
                  </span>
                  <span className="font-extrabold text-gray-800 group-hover:text-sena-green transition-colors">
                    {article.created_by_user?.full_name || "Soporte Técnico"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-5 group">
                <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors duration-300">
                  <Clock className="w-5 h-5 text-gray-400 group-hover:text-current" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                    Registrado el
                  </span>
                  <span className="font-extrabold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {format(new Date(article.created_at), "PPP", {
                      locale: es,
                    })}
                  </span>
                </div>
              </div>

              {article.updated_at !== article.created_at && (
                <div className="flex items-center gap-5 group">
                  <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors duration-300">
                    <Clock className="w-5 h-5 text-gray-400 group-hover:text-current" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                      Última modificación
                    </span>
                    <span className="font-extrabold text-gray-800 group-hover:text-amber-600 transition-colors line-clamp-1">
                      {format(new Date(article.updated_at), "PPP", {
                        locale: es,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-[0.2em] flex items-center justify-between">
              Material Adjunto
              <span className="bg-red-50 text-red-500 px-3 py-1 rounded-xl text-[10px] shadow-sm font-black">
                {article.file_urls?.length || 0}
              </span>
            </h3>

            <div className="space-y-3">
              {article.file_urls && article.file_urls.length > 0 ? (
                article.file_urls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-2xl transition-all group active:scale-95 shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-white text-red-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-black text-gray-700 group-hover:text-red-600 transition-colors truncate max-w-[120px]">
                        MANUAL_TÉCNICO_{idx + 1}
                      </span>
                    </div>
                    <Download className="w-5 h-5 text-gray-300 group-hover:text-red-500 transition-all group-hover:translate-y-0.5" />
                  </a>
                ))
              ) : (
                <div className="text-center py-10 space-y-4 bg-gray-50/50 rounded-[1.5rem] border-2 border-dashed border-gray-100">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <FileText className="w-6 h-6 text-gray-200" />
                  </div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Sin archivos adjuntos
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <ArticleEditor
          article={article}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            fetchArticle();
            setIsEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
