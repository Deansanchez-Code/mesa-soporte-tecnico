import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export const getSupabaseAdmin = () => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "❌ SUPABASE_SERVICE_ROLE_KEY no está configurada. Operación administrativa no permitida.",
    );
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      auth: {
        autoRefreshToken: false, // Not needed for admin
        persistSession: false,
      },
    },
  );
};
