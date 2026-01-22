"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Plus, MapPin } from "lucide-react";
import BulkAssignmentModal from "./BulkAssignmentModal";
import CalendarView from "./CalendarView";
import { Assignment } from "../types";
import AuditoriumReservationForm from "@/features/reservations/components/AuditoriumReservationForm";
import { UserProfile } from "@/features/auth/hooks/useUserProfile";

interface Environment {
  id: number;
  name: string;
  type: string;
  capacity: number;
}

export default function AssignmentManager({
  canManage,
  canDeleteAuditorium,
  user,
}: {
  canManage: boolean;
  canDeleteAuditorium: boolean;
  user?: UserProfile["profile"];
}) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingRes, setEditingRes] = useState<Assignment | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEnvironments = async () => {
    setLoading(true);
    // Fetch AMBIENTE and AUDITORIO, excluding KIOSKO
    const { data } = await supabase
      .from("areas")
      .select("id, name")
      .or("name.ilike.%AMBIENTE%,name.ilike.%AUDITORIO%")
      .not("name", "ilike", "%KIOSKO%")
      .order("name");

    if (data) {
      // Prioritize AUDITORIO to be the first option
      // Filter out "AMBIENTE DE INSTRUCTORES"
      const filtered = data.filter(
        (d) => !d.name.toUpperCase().includes("AMBIENTE DE INSTRUCTORES"),
      );

      const mapped = filtered
        .map((d: { id: number; name: string }) => ({
          id: d.id,
          name: d.name,
          type: "AREA",
          capacity: 0,
        }))
        .sort((a, b) => {
          if (a.name.toUpperCase().includes("AUDITORIO")) return -1;
          if (b.name.toUpperCase().includes("AUDITORIO")) return 1;
          return a.name.localeCompare(b.name);
        });

      setEnvironments(mapped);
      if (mapped.length > 0 && !selectedEnvId) {
        setSelectedEnvId(mapped[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEnvironments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
      {/* HEADER: Tabs de Ambientes */}
      <div className="border-b border-gray-100 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapPin className="text-sena-green" />
            Gestión de Ambientes
          </h2>
          {canManage && selectedEnv && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-sena-green text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-900/20"
            >
              <Plus className="w-4 h-4" />
              Nueva Asignación
            </button>
          )}
        </div>

        {/* Scrollable Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-gray-200">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnvId(env.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedEnvId === env.id
                  ? "bg-blue-50 text-sena-blue border border-blue-200 shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
              }`}
            >
              {env.name}
            </button>
          ))}
          {loading && (
            <div className="text-xs text-gray-400 p-2">
              Cargando ambientes...
            </div>
          )}
        </div>
      </div>

      {/* CONTENT: Calendario */}
      <div className="flex-1 p-6 bg-gray-50/50">
        {selectedEnvId ? (
          <CalendarView
            areaId={selectedEnvId}
            areaName={selectedEnv?.name || ""}
            key={selectedEnvId + "-" + refreshTrigger} // Force re-render on switch
            canManage={canManage}
            canDeleteAuditorium={canDeleteAuditorium}
            user={user}
            onEdit={(res) => setEditingRes(res)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MapPin className="w-12 h-12 mb-2 opacity-50" />
            <p>Selecciona un ambiente para ver su programación.</p>
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && selectedEnv && (
        <BulkAssignmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          environmentId={selectedEnv.id}
          environmentName={selectedEnv.name}
          onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* EDIT MODAL FOR RESERVATIONS */}
      {editingRes && user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <AuditoriumReservationForm
              user={user}
              reservationToEdit={editingRes as any}
              onCancel={() => setEditingRes(null)}
              onSuccess={() => {
                setEditingRes(null);
                setRefreshTrigger((prev) => prev + 1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
