"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export interface UserProfile {
  user: User | null;
  profile: Record<string, unknown> | null;
  loading: boolean;
  role: string | null;
  permissions?: {
    manage_assignments: boolean;
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
    async function getUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const user = session.user;
        const role = user.user_metadata?.role || "user"; // Asumimos rol en metadata

        setState({
          permissions: {
            manage_assignments:
              (user.user_metadata?.perm_manage_assignments as boolean) || false,
          },
          user,
          profile: user.user_metadata,
          loading: false,
          role,
        });
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setState((prev) => ({ ...prev, loading: false }));
      }
    }

    getUser();

    // Listener de cambios de auth
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setState({ user: null, profile: null, loading: false, role: null });
        } else if (session?.user) {
          const user = session.user;
          setState({
            user,
            profile: user.user_metadata,
            loading: false,
            role: user.user_metadata?.role || "user",
          });
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
