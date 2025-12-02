import { createClient } from "@supabase/supabase-js";
import { safeGetItem, safeSetItem, safeRemoveItem } from "./storage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: {
      getItem: (key) => safeGetItem(key),
      setItem: (key, value) => safeSetItem(key, value),
      removeItem: (key) => safeRemoveItem(key),
    },
    persistSession: true,
  },
});
