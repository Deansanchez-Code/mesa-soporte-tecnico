import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // We can't throw here at top-level in Edge/Next sometimes, but it will fail on usage.
  console.error("Missing Supabase Service Role configuration.");
}

export const getSupabaseAdmin = () => {
  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false, // Not needed for admin
      persistSession: false,
    },
  });
};
