"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Agent, User } from "@/app/admin/types";

export function useUserManagement(onRefresh: () => void) {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgent, setNewAgent] = useState({
    id: "", // Para edición
    fullName: "",
    username: "",
    password: "",
    role: "agent",
    area: "Mesa de Ayuda",
    is_active: true,
    perm_create_assets: false,
    perm_transfer_assets: false,
    perm_decommission_assets: false,
    is_vip: false,
    isEditing: false,
  });

  const resetUserForm = () => {
    setNewAgent({
      id: "",
      fullName: "",
      username: "",
      password: "",
      role: "agent",
      area: "Mesa de Ayuda",
      is_active: true,
      perm_create_assets: false,
      perm_transfer_assets: false,
      perm_decommission_assets: false,
      is_vip: false,
      isEditing: false,
    });
  };

  const handleCreateOrUpdateUser = async () => {
    let passwordToSave = newAgent.password;

    // Si es usuario de planta y no puso clave, asignar por defecto
    if (newAgent.role === "user" && !passwordToSave) {
      passwordToSave = "Sena2024*";
    }

    if (!newAgent.fullName || !newAgent.username || !passwordToSave)
      return alert("Faltan datos obligatorios (Nombre, Usuario, Contraseña)");

    try {
      if (newAgent.isEditing) {
        // ACTUALIZAR
        const { error } = await supabase
          .from("users")
          .update({
            full_name: newAgent.fullName,
            username: newAgent.username.toLowerCase(),
            role: newAgent.role,
            area: newAgent.area,
            password: passwordToSave,
            is_active: newAgent.is_active,
            perm_create_assets: newAgent.perm_create_assets,
            perm_transfer_assets: newAgent.perm_transfer_assets,
            perm_decommission_assets: newAgent.perm_decommission_assets,
            is_vip: newAgent.is_vip,
          })
          .eq("id", newAgent.id);
        if (error) throw error;
        alert("✅ Usuario actualizado");
      } else {
        // CREAR
        const { error } = await supabase.from("users").insert({
          full_name: newAgent.fullName,
          username: newAgent.username.toLowerCase(),
          role: newAgent.role,
          area: newAgent.area,
          password: passwordToSave,
          is_active: newAgent.is_active,
          perm_create_assets: newAgent.perm_create_assets,
          perm_transfer_assets: newAgent.perm_transfer_assets,
          perm_decommission_assets: newAgent.perm_decommission_assets,
          is_vip: newAgent.is_vip,
        });
        if (error) throw error;
        alert("✅ Usuario creado");
      }

      setShowAgentModal(false);
      resetUserForm();
      onRefresh();
    } catch {
      alert("Error al guardar. Verifica si el usuario ya existe.");
    }
  };

  const handleEditUser = (user: Agent | User) => {
    setNewAgent({
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      password: (user as any).password || "",
      role: user.role,
      area: user.area || "",
      is_active: user.is_active,
      perm_create_assets: (user as any).perm_create_assets || false,
      perm_transfer_assets: (user as any).perm_transfer_assets || false,
      perm_decommission_assets: (user as any).perm_decommission_assets || false,
      is_vip: user.is_vip,
      isEditing: true,
    });
    setShowAgentModal(true);
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

    try {
      const { error } = await supabase.from("users").delete().eq("id", id);

      if (error) {
        if (error.code === "23503") {
          alert(
            "❌ No se puede eliminar este usuario porque tiene tickets o activos asignados.\n\nPor favor, reasigna sus responsabilidades antes de eliminarlo."
          );
        } else {
          throw error;
        }
      } else {
        alert("✅ Usuario eliminado correctamente");
        onRefresh();
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(
        "Error al eliminar el usuario. Consulta la consola para más detalles."
      );
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
