"use client";

import { useState } from "react";
import { Agent, User } from "@/app/admin/admin.types";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

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

    // Para usuarios Kiosko sin contraseña ingresada, generar secreto aleatorio fuerte (el acceso se realiza vía OTP)
    if (newAgent.role === "user" && !passwordToSave && !newAgent.isEditing) {
      const bytes = new Uint8Array(18);
      window.crypto.getRandomValues(bytes);
      passwordToSave = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 20);
    }

    if (
      !newAgent.full_name ||
      !newAgent.username ||
      (!newAgent.isEditing && !passwordToSave)
    )
      return toast.warning("Faltan datos obligatorios", {
        description: "Por favor complete Nombre, Usuario y Contraseña",
      });

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

      toast.success(
        newAgent.isEditing ? "Usuario actualizado" : "Usuario creado",
        {
          description: newAgent.isEditing
            ? `Los datos de ${newAgent.username} han sido guardados.`
            : `El usuario ${newAgent.username} se ha registrado exitosamente.`,
        },
      );
      setShowAgentModal(false);
      resetUserForm();
      onRefresh();
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error en la operación", { description: errMsg });
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
          toast.error("Error de Dependencias", {
            description: "No se puede eliminar: tiene registros asociados.",
          });
        } else {
          throw new Error(data.error || "Error al eliminar");
        }
      } else {
        toast.success("Usuario Desactivado", {
          description: "El usuario ha sido dado de baja correctamente.",
        });
        onRefresh();
      }
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      const errMsg =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al desactivar", { description: errMsg });
    }
  };

  const handleToggleUserActive = async (user: Agent | User) => {
    const targetState = !user.is_active;
    const actionName = targetState ? "HABILITAR" : "DESACTIVAR";

    if (
      !confirm(
        `¿Seguro que deseas ${actionName} a ${user.full_name || user.username}?\n\n${
          targetState
            ? "El usuario podrá ingresar nuevamente y conservará todo su historial previo."
            : "El usuario ya no podrá ingresar, pero conservará su historial intacto."
        }`,
      )
    )
      return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const payload = {
        id: user.auth_id || user.id,
        is_active: targetState,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        area: user.area,
        is_vip: user.is_vip,
        employment_type: user.employment_type,
        job_category: user.job_category,
      };

      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Error al cambiar estado");

      toast.success(
        targetState ? "Usuario Habilitado" : "Usuario Desactivado",
        {
          description: targetState
            ? `El usuario ${user.username} ha sido reactivado.`
            : `El usuario ${user.username} ha sido inhabilitado.`,
        },
      );
      onRefresh();
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al cambiar estado", { description: errMsg });
    }
  };

  const handleToggleCoordinator = async (user: Agent | User) => {
    const isCurrentlyCoordinator =
      user.job_category?.toLowerCase() === "coordinador";
    const targetCoordinator = !isCurrentlyCoordinator;

    if (
      !confirm(
        targetCoordinator
          ? `¿Designar a ${user.full_name || user.username} como COORDINADOR(A)?\n\nObtendrá automáticamente privilegios VIP y permisos ampliados de gestión y asignación de ambientes.`
          : `¿Retirar el rol de Coordinador(a) a ${user.full_name || user.username}?`,
      )
    )
      return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const payload = {
        id: user.auth_id || user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        area: user.area,
        is_active: user.is_active,
        employment_type: user.employment_type || "planta",
        job_category: targetCoordinator ? "coordinador" : "funcionario",
        is_vip: targetCoordinator ? true : user.is_vip,
        perm_manage_assignments: targetCoordinator ? true : false,
      };

      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Error al actualizar privilegios");

      toast.success(
        targetCoordinator
          ? "Coordinador(a) Designado(a)"
          : "Rol de Coordinador Retirado",
        {
          description: targetCoordinator
            ? `${user.full_name} ahora cuenta con privilegios VIP y funciones de coordinación.`
            : `Se actualizaron los permisos de ${user.full_name}.`,
        },
      );
      onRefresh();
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al cambiar rol de coordinación", {
        description: errMsg,
      });
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
    handleToggleUserActive,
    handleToggleCoordinator,
    resetUserForm,
  };
}
