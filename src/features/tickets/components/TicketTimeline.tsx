import React from "react";
import { Clock } from "lucide-react";

interface TimelineItem {
  id?: string;
  title: string;
  displayDate: string;
  actor?: string;
  text?: string;
  type?:
    | "creation"
    | "update"
    | "status_change"
    | "comment"
    | "legacy"
    | "event";
  rawType?: string;
}

interface TicketTimelineProps {
  loadingEvents: boolean;
  timelineItems: TimelineItem[];
}

export function TicketTimeline({
  loadingEvents,
  timelineItems,
}: TicketTimelineProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(timelineItems.length / itemsPerPage);
  const visibleItems = timelineItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm min-h-[300px]">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
        <Clock className="w-4 h-4 text-gray-400" /> Historial de Eventos
        {loadingEvents && (
          <span className="text-[10px] text-gray-400 font-normal ml-2 animate-pulse">
            Cargando...
          </span>
        )}
      </h3>

      <div className="relative border-l-2 border-gray-100 ml-2 space-y-6">
        {visibleItems.map((item, idx) => (
          <div key={idx} className="relative pl-6 group">
            <div
              className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 
                        ${
                          item.rawType === "PAUSED"
                            ? "bg-purple-500 ring-purple-200"
                            : item.rawType === "RESUMED"
                              ? "bg-green-500 ring-green-200"
                              : item.type === "legacy"
                                ? "bg-blue-400 ring-blue-100"
                                : item.type === "creation"
                                  ? "bg-gray-300 ring-gray-200"
                                  : "bg-gray-400 ring-gray-200"
                        }`}
            ></div>

            <div className="flex justify-between items-start">
              <h4
                className={`font-bold text-xs ${
                  item.rawType === "PAUSED"
                    ? "text-purple-700"
                    : "text-gray-700"
                }`}
              >
                {item.title}
              </h4>
              <span className="text-[10px] text-gray-400">
                {item.displayDate}
              </span>
            </div>

            {item.actor && (
              <p className="text-[10px] text-gray-400 mb-1">
                por{" "}
                <span className="font-medium text-gray-600">{item.actor}</span>
              </p>
            )}

            {item.text && (
              <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                {item.text}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Pág {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
