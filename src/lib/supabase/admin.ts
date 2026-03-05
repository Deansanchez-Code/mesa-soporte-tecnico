import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export const getSupabaseAdmin = () => {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.replace(
    /^http:\/\/(?!localhost|127\.0\.0\.1)/i,
    "https://",
  );

  return createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false, // Not needed for admin
      persistSession: false,
    },
  });
};
