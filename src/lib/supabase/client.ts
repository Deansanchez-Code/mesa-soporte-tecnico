import { createBrowserClient } from "@supabase/ssr";
import { safeGetItem, safeSetItem, safeRemoveItem } from "../storage";

import { env } from "@/env";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const createSupabaseClient = () =>
  createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: {
        getItem: safeGetItem,
        setItem: safeSetItem,
        removeItem: safeRemoveItem,
      },
      persistSession: true,
      detectSessionInUrl: true,
      // Debug: false to reduce noise, can enable if needed
    },
  });

// Singleton pattern for Next.js to avoid "Multiple GoTrueClient instances" warning during HMR
const globalForSupabase = global as unknown as {
  supabase: ReturnType<typeof createSupabaseClient> | undefined;
};

export const supabase = globalForSupabase.supabase ?? createSupabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = supabase;
}
