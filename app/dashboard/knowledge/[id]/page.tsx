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
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/knowledge")}
          className="flex items-center gap-2 text-gray-500 hover:text-sena-green font-bold transition-colors group"
        >
          <div className="bg-white p-2 rounded-xl group-hover:bg-sena-green/10 shadow-sm border border-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </div>
          Volver al Repositorio
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditorOpen(true)}
            className="p-2.5 bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-gray-100 shadow-sm transition-all"
            title="Editar solución"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2.5 bg-white text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-100 shadow-sm transition-all"
            title="Eliminar solución"
          >
            {isDeleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Solution Detail */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    article.category === "Hardware"
                      ? "bg-amber-100 text-amber-700"
                      : article.category === "Software"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {article.category}
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {article.problem_type}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                {article.title}
              </h1>
            </div>

            <div className="border-t border-gray-50 pt-6 prose prose-slate max-w-none">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-sena-green" />
                Solución Técnica
              </h2>
              <div className="bg-gray-50/50 p-6 rounded-2xl whitespace-pre-wrap text-gray-700 leading-relaxed font-medium">
                {article.solution}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Metadata & Files */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Información
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-gray-600">
                <div className="p-2 bg-gray-50 rounded-xl">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Autor
                  </span>
                  <span className="text-sm font-bold">
                    {article.created_by_user?.full_name || "Soporte Técnico"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-gray-600">
                <div className="p-2 bg-gray-50 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Creado el
                  </span>
                  <span className="text-sm font-bold">
                    {format(new Date(article.created_at), "PPP", {
                      locale: es,
                    })}
                  </span>
                </div>
              </div>

              {article.updated_at !== article.created_at && (
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="p-2 bg-gray-50 rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Actualizado
                    </span>
                    <span className="text-sm font-bold">
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
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
              Manuales Adjuntos
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md text-[10px]">
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
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-sena-green/5 border border-transparent hover:border-sena-green/20 rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 text-red-500 rounded-lg group-hover:scale-110 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        Manual_Tecnico_{idx + 1}.pdf
                      </span>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 group-hover:text-sena-green" />
                  </a>
                ))
              ) : (
                <div className="text-center py-6 space-y-2">
                  <FileText className="w-8 h-8 text-gray-100 mx-auto" />
                  <p className="text-xs text-gray-400 font-medium">
                    No hay manuales adjuntos
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
