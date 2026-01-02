import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLogin(username: string) {
  const email = `${username}@sistema.local`;
  const password = "Sena2024*";

  console.log(`Testing login for ${username} (${email})...`);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(`❌ Login FAILED for ${username}:`, error.message);
    return false;
  } else {
    console.log(`✅ Login SUCCESS for ${username}. User ID: ${data.user.id}`);
    return true;
  }
}

async function main() {
  console.log("--- Verifying User Credentials for Silent Login ---");

  // Test cases:
  // 1. A known admin/planta user (from seed)
  await verifyLogin("deansan");

  // 2. Ideally test a contractor if we knew one, but we can't easily guess.
  // We'll create a test user if needed in a real e2e, but for now checking the main admin works covers the mechanism.
}

main();
