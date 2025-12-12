import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  role: "admin" | "agent" | "user" | "superadmin";
  area: string;
  is_active: boolean;
  is_vip: boolean;
  employment_type?: string;
  job_category?: string;
}

export function useUserProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // 1. Get Auth Session (Cookie based)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setLoading(false);
          return;
        }

        // 2. Fetch Profile from Public Table
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error) throw error;

        setUser(data as UserProfile);
      } catch (err: unknown) {
        // Ignorar error si no encuentra registros (PGRST116)
        if ((err as { code?: string }).code !== "PGRST116") {
          console.error("Error fetching user profile:", err);
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { user, loading, error };
}
