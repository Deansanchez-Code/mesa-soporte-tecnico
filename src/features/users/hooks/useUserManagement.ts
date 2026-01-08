"use client";

import { useState } from "react";
import { Agent, User } from "@/app/admin/types";
import { supabase } from "@/lib/supabase/cliente";

export type AgentFormData = Agent & {
  password?: string;
  isEditing?: boolean;
};

export function useUserManagement(onRefresh: () => void) {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgent, setNewAgent] = useState<AgentFormData>({
    id: "", // Para edición (auth_id)
    full_name: "",
    username: "",
    password: "",
    role: "agent",
    area: "Mesa de Ayuda",
    is_active: true,
    perm_create_assets: false,
    perm_transfer_assets: false,
    perm_decommission_assets: false,
    is_vip: false,
    employment_type: "planta",
    job_category: "funcionario",
    perm_manage_assignments: false,
    isEditing: false,
    email: null,
    created_at: null,
  });

  const resetUserForm = () => {
    setNewAgent({
      id: "",
      full_name: "",
      username: "",
      password: "",
      role: "agent",
      area: "Mesa de Ayuda",
      is_active: true,
      perm_create_assets: false,
      perm_transfer_assets: false,
      perm_decommission_assets: false,
      is_vip: false,
      employment_type: "planta",
      job_category: "funcionario",
      perm_manage_assignments: false,
      isEditing: false,
      email: null,
      created_at: null,
    });
  };

  const handleCreateOrUpdateUser = async () => {
    let passwordToSave = newAgent.password;

    // Si es usuario de planta y no puso clave, asignar por defecto
    if (newAgent.role === "user" && !passwordToSave) {
      passwordToSave = "Sena2024*";
    }

    if (
      !newAgent.full_name ||
      !newAgent.username ||
      (!newAgent.isEditing && !passwordToSave)
    )
      return alert("Faltan datos obligatorios (Nombre, Usuario, Contraseña)");

    try {
      // Get Session Token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const payload = {
        id: newAgent.id, // Needed for update
        email: `${newAgent.username}@sistema.local`, // Construct email from username
        password: passwordToSave,
        full_name: newAgent.full_name,
        username: newAgent.username.toLowerCase(),
        role: newAgent.role,
        area: newAgent.area,
        is_active: newAgent.is_active,
        perm_create_assets: newAgent.perm_create_assets,
        perm_transfer_assets: newAgent.perm_transfer_assets,
        perm_decommission_assets: newAgent.perm_decommission_assets,
        is_vip: newAgent.is_vip,
        employment_type: newAgent.employment_type,
        job_category: newAgent.job_category,
        perm_manage_assignments: newAgent.perm_manage_assignments,
      };

      const method = newAgent.isEditing ? "PUT" : "POST";
      const response = await fetch("/api/admin/users", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en la operación");
      }

      alert(
        newAgent.isEditing ? "✅ Usuario actualizado" : "✅ Usuario creado",
      );
      setShowAgentModal(false);
      resetUserForm();
      onRefresh();
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Error desconocido";
      alert(`Error: ${errMsg}`);
    }
  };

  const handleEditUser = (user: Agent | User) => {
    setNewAgent({
      id: user.auth_id || user.id, // Prefer auth_id if available
      full_name: user.full_name,
      username: user.username,
      email: user.email || null,
      created_at: user.created_at || null,

      password: "", // Don't show existing password
      role: user.role,
      area: user.area || "",
      is_active: user.is_active,
      perm_create_assets: user.perm_create_assets || false,
      perm_transfer_assets: user.perm_transfer_assets || false,
      perm_decommission_assets: user.perm_decommission_assets || false,
      is_vip: user.is_vip,
      employment_type: user.employment_type || "planta",
      job_category: user.job_category || "funcionario",
      perm_manage_assignments: user.perm_manage_assignments || false,
      isEditing: true,
    });
    setShowAgentModal(true);
  };

  const handleDeleteUser = async (id: string) => {
    // SOFT DELETE WARNING
    if (
      !confirm(
        "⚠️ ¿Seguro que deseas DESACTIVAR este usuario?\n\nEl usuario no podrá ingresar más, pero sus datos históricos se conservarán por 6 años.",
      )
    )
      return;

    try {
      // Get Session Token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const response = await fetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error && data.error.includes("foreign key")) {
          alert("❌ Error: Dependencias encontradas. Contacte a soporte DB.");
        } else {
          throw new Error(data.error || "Error al eliminar");
        }
      } else {
        alert("✅ Usuario desactivado correctamente (Baja Lógica)");
        onRefresh();
      }
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      const errMsg =
        error instanceof Error ? error.message : "Error desconoodo";
      alert(`Error al desactivar: ${errMsg}`);
    }
  };

  return {
    showAgentModal,
    setShowAgentModal,
    newAgent,
    setNewAgent,
    handleCreateOrUpdateUser,
    handleEditUser,
    handleDeleteUser,
    resetUserForm,
  };
}
