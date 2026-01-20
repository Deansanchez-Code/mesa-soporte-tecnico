"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  BookOpen,
  ChevronRight,
  X,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Article {
  id: string;
  title: string;
  category: "Hardware" | "Software" | "Otro";
  problem_type: string;
  solution: string;
}

interface KnowledgeSearchModalProps {
  onClose: () => void;
  onSelect: (solutionText: string) => void;
}

export default function KnowledgeSearchModal({
  onClose,
  onSelect,
}: KnowledgeSearchModalProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("q", searchTerm);
      if (selectedCategory !== "Todos")
        params.append("category", selectedCategory);

      const response = await fetch(`/api/knowledge?${params.toString()}`);
      if (!response.ok) throw new Error("Error fetching articles");
      const data = await response.json();
      setArticles(data);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando soluciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchArticles();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-200">
        {/* LEFT PANE: Search & Results */}
        <div
          className={`${viewingArticle ? "hidden md:flex" : "flex"} flex-col w-full md:w-1/2 border-r border-gray-100 bg-gray-50/50`}
        >
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sena-green" />
                Buscar Solución
              </h3>
              <button
                onClick={onClose}
                className="md:hidden p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar problema..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sena-green outline-none"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {["Todos", "Hardware", "Software", "Otro"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-sena-green text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-sena-green" />
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No se encontraron soluciones.
              </div>
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setViewingArticle(article)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    viewingArticle?.id === article.id
                      ? "bg-white border-sena-green shadow-md ring-1 ring-sena-green/20"
                      : "bg-white border-gray-200 hover:border-sena-green/50 hover:shadow-sm"
                  }`}
                >
                  <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">
                    {article.title}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {article.solution}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANE: Preview & Action */}
        <div
          className={`${viewingArticle ? "flex" : "hidden md:flex"} flex-col w-full md:w-1/2 bg-white`}
        >
          {viewingArticle ? (
            <>
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                <button
                  onClick={() => setViewingArticle(null)}
                  className="md:hidden flex items-center text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                  <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Volver
                </button>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sena-green bg-green-50 px-2 py-1 rounded">
                    {viewingArticle.category}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 mt-2">
                    {viewingArticle.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    {viewingArticle.problem_type}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed dark:prose-invert">
                  {viewingArticle.solution.split("\n").map((line, i) => (
                    <p key={i} className="mb-2 last:mb-0">
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button
                  onClick={() => onSelect(viewingArticle.solution)}
                  className="flex-1 md:flex-none px-6 py-2.5 bg-sena-green hover:bg-[#2d8500] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/10 transition-transform active:scale-95"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Solución
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/30">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium">
                Selecciona una solución para ver los detalles
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
