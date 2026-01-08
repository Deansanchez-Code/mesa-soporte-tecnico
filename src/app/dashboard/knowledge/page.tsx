"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  BookOpen,
  Monitor,
  Cpu,
  FileText,
  Filter,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ArticleEditor from "@/features/knowledge/components/ArticleEditor";

interface Article {
  id: string;
  title: string;
  category: "Hardware" | "Software" | "Otro";
  problem_type: string;
  solution: string;
  file_urls: string[];
  created_at: string;
  created_by_user?: {
    full_name: string;
  };
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (selectedCategory !== "Todos")
        params.append("category", selectedCategory);

      const response = await fetch(`/api/knowledge?${params.toString()}`);
      if (!response.ok) throw new Error("Error fetching articles");
      const data = await response.json();
      setArticles(data);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar las soluciones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Navigation & Header */}
      <div className="space-y-6">
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="flex items-center gap-2 text-gray-500 hover:text-sena-green font-bold transition-all group"
        >
          <div className="bg-white p-2 rounded-xl group-hover:bg-sena-green/10 shadow-sm border border-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </div>
          Volver al Dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-4">
              <div className="bg-sena-green/10 p-3 rounded-2xl">
                <BookOpen className="text-sena-green w-10 h-10" />
              </div>
              Repositorio de <span className="text-sena-green">Soporte</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium max-w-2xl">
              Banco centralizado de soluciones técnicas, manuales y lecciones
              aprendidas para optimizar nuestro tiempo de respuesta.
            </p>
          </div>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="bg-sena-green hover:bg-[#2d8500] text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-green-900/20"
          >
            <Plus className="w-6 h-6" />
            Nueva Solución
          </button>
        </div>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <ArticleEditor
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            fetchArticles();
            setIsEditorOpen(false);
          }}
        />
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-4 top-3 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por título, problema o palabras clave..."
            className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-sena-green text-gray-700 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Filter className="text-gray-400 w-4 h-4 ml-2" />
          {["Todos", "Hardware", "Software", "Otro"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-sena-green text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-sena-green animate-spin" />
          <p className="text-gray-500 font-medium">Buscando soluciones...</p>
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-700">
            No se encontraron resultados
          </h3>
          <p className="text-gray-500">Intenta con otros términos o filtros.</p>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="group bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-2xl hover:border-sena-green/20 transition-all duration-500 relative flex flex-col h-full hover:-translate-y-1">
      <div className="flex items-start justify-between mb-6">
        <div
          className={`p-3.5 rounded-2xl transition-transform group-hover:scale-110 duration-500 ${
            article.category === "Hardware"
              ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
              : article.category === "Software"
                ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
                : "bg-gray-50 text-gray-600 ring-1 ring-gray-100"
          }`}
        >
          {article.category === "Hardware" ? (
            <Cpu className="w-6 h-6" />
          ) : article.category === "Software" ? (
            <Monitor className="w-6 h-6" />
          ) : (
            <FileText className="w-6 h-6" />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md">
            {format(new Date(article.created_at), "dd MMM yyyy", {
              locale: es,
            })}
          </span>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-800 line-clamp-2 min-h-[3.5rem] group-hover:text-sena-green transition-colors decoration-sena-green/30 underline-offset-4 mb-2">
        {article.title}
      </h3>

      <div className="flex gap-2 mb-4">
        <div className="text-[10px] font-extrabold px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg uppercase tracking-tight">
          {article.problem_type}
        </div>
      </div>

      <p className="text-sm text-gray-500 line-clamp-3 flex-grow leading-relaxed">
        {article.solution.replace(/[#*`]/g, "")}
      </p>

      <div className="mt-8 pt-5 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sena-green to-green-700 flex items-center justify-center text-xs font-bold text-white shadow-sm shadow-green-900/20">
            {article.created_by_user?.full_name?.charAt(0) || "S"}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Autor
            </span>
            <span className="text-xs text-gray-700 font-bold">
              {article.created_by_user?.full_name || "Soporte Técnico"}
            </span>
          </div>
        </div>

        <button
          onClick={() =>
            (window.location.href = `/dashboard/knowledge/${article.id}`)
          }
          className="bg-gray-50 hover:bg-sena-green text-gray-400 hover:text-white p-2 rounded-xl transition-all shadow-sm border border-gray-100 hover:border-sena-green"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {article.file_urls && article.file_urls.length > 0 && (
        <div className="absolute top-6 right-16">
          <div
            className="bg-red-50 text-red-500 p-1.5 rounded-lg ring-1 ring-red-100 flex items-center gap-1 shadow-sm"
            title="Contiene manuales PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold uppercase">
              {article.file_urls.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
