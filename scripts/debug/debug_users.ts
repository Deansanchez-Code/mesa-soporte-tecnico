import dotenv from "dotenv";
dotenv.config({ path: ".env.local", debug: false });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUsers() {
  const { data, error } = await supabase.from("users").select("*").limit(1);
  if (error) {
    console.log("ERROR:", error.message);
  } else {
    console.log("User Sample:", data && data[0]);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    }
  }
}

inspectUsers();
