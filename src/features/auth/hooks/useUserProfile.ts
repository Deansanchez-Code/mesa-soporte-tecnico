"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { User } from "@supabase/supabase-js";

export interface UserProfile {
  user: User | null;
  profile: {
    id?: string;
    full_name?: string;
    is_vip?: boolean;
    role?: string;
    perm_create_assets?: boolean;
    perm_transfer_assets?: boolean;
    perm_decommission_assets?: boolean;
    [key: string]: unknown;
  } | null;
  loading: boolean;
  role: string | null;
  permissions?: {
    manage_assignments: boolean;
    create_assets?: boolean;
    transfer_assets?: boolean;
    decommission_assets?: boolean;
  };
}

export function useUserProfile() {
  const [state, setState] = useState<UserProfile>({
    user: null,
    profile: null, // Si necesitamos datos extra de tabla 'users'
    loading: true,
    role: null,
  });

  useEffect(() => {
    // Función centralizada para obtener datos de DB
    async function fetchProfileData(user: User) {
      try {
        const { data: dbUser } = await supabase
          .from("users")
          .select(
            "id, full_name, is_vip, perm_manage_assignments, perm_create_assets, perm_transfer_assets, perm_decommission_assets",
          )
          .eq("auth_id", user.id)
          .single();

        const metadataRole = user.user_metadata?.role?.toLowerCase();
        const isVipMetadata = !!(
          user.user_metadata?.is_vip || metadataRole === "vip"
        );

        setState({
          permissions: {
            manage_assignments: dbUser?.perm_manage_assignments || false,
            create_assets: dbUser?.perm_create_assets || false,
            transfer_assets: dbUser?.perm_transfer_assets || false,
            decommission_assets: dbUser?.perm_decommission_assets || false,
          },
          user,
          profile: {
            ...user.user_metadata,
            id: dbUser?.id || user.id, // Ensure we always have an ID for ownership checks
            full_name: dbUser?.full_name || user.user_metadata?.full_name, // Prioridad DB
            is_vip: !!(dbUser?.is_vip || isVipMetadata),
            perm_create_assets: dbUser?.perm_create_assets,
            perm_transfer_assets: dbUser?.perm_transfer_assets,
            perm_decommission_assets: dbUser?.perm_decommission_assets,
          },
          loading: false,
          role: user.user_metadata?.role || "user",
        });
      } catch (error) {
        console.error("Error fetching user profile:", error);
        const metadataRole = user.user_metadata?.role?.toLowerCase();
        setState({
          user,
          profile: {
            ...user.user_metadata,
            id: user.id,
            is_vip: !!(user.user_metadata?.is_vip || metadataRole === "vip"),
            full_name: user.user_metadata?.full_name,
          },
          loading: false,
          role: metadataRole || "user",
        });
      }
    }

    async function initUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      // Fetch inicial
      fetchProfileData(session.user);
    }

    initUser();

    // Listener de cambios de auth
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          setState({ user: null, profile: null, loading: false, role: null });
        } else if (session?.user) {
          // Si cambia el usuario o inicia sesión, refrescar datos de DB
          // IMPORTANTE: Esto asegura que el nombre y permisos estén frescos
          fetchProfileData(session.user);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
