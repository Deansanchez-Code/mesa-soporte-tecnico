"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Upload, X, Loader2, Save } from "lucide-react";

interface CreateAssetModalProps {
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}

export default function CreateAssetModal({
  onClose,
  onSuccess,
  currentUserId,
}: CreateAssetModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    serial_number: "",
    type: "Portátil", // Default
    brand: "",
    model: "",
    location: "",
    condition: "NUEVO",
    assigned_to_user_id: "", // Optional initially? Or assign to self? Or stock?
  });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let fileUrl = null;
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `new_asset_${formData.serial_number}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("asset-authorizations") // Reusing existing bucket
          .upload(`creation/${fileName}`, file);

        if (uploadError) throw uploadError;
        fileUrl = `creation/${fileName}`;
      }

      const { error } = await supabase.from("assets").insert({
        serial_number: formData.serial_number,
        type: formData.type,
        brand: formData.brand,
        model: formData.model,
        location: formData.location || "Bodega",
        status: "DISPONIBLE",
        condition: formData.condition,
        assigned_to_user_id: null, // Initially unassigned or logic to assign
        created_by: currentUserId,
        image_url: fileUrl, // If schema has this
      });

      if (error) throw error;

      alert("Activo creado correctamente.");
      onSuccess();
    } catch (error) {
      console.error("Error creating asset:", error);
      alert("Error al crear el activo. Verifique que el serial no exista.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-sena-green p-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <Save className="w-5 h-5" /> Registrar Nuevo Activo
          </h3>
          <button onClick={onClose} className="hover:text-green-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Serial *
              </label>
              <input
                type="text"
                required
                value={formData.serial_number}
                onChange={(e) =>
                  setFormData({ ...formData, serial_number: e.target.value })
                }
                className="w-full p-2 border rounded-lg uppercase"
                placeholder="PLACA-001"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full p-2 border rounded-lg"
              >
                <option value="Portátil">Portátil</option>
                <option value="PC Escritorio">PC Escritorio</option>
                <option value="Monitor">Monitor</option>
                <option value="Periférico">Periférico</option>
                <option value="Redes">Redes</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Marca
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) =>
                  setFormData({ ...formData, brand: e.target.value })
                }
                className="w-full p-2 border rounded-lg"
                placeholder="HP, Lenovo..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Modelo
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                className="w-full p-2 border rounded-lg"
                placeholder="ProBook 440..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Ubicación Inicial
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full p-2 border rounded-lg"
              placeholder="Bodega, Ambiente 101..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Foto / Soporte (Opcional)
            </label>
            <div className="border border-gray-300 rounded-lg p-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-gray-400" />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm p-1 w-full"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-sena-green text-white font-bold rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Guardar Activo"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
