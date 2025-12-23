import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function verifySystem() {
  console.log("🔍 Starting System Verification...\n");

  // 1. Verify User Migration
  console.log("--- 1. User Migration Check ---");
  const { count: unmigratedCount, error: countError } = await serviceClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .is("auth_id", null);

  if (countError) {
    console.error("Error checking users:", countError.message);
  } else {
    console.log(`Unmigrated users (auth_id is NULL): ${unmigratedCount}`);
    if (unmigratedCount === 0) {
      console.log("✅ User migration appears complete.");
    } else {
      console.log(`❌ Pending migrations for ${unmigratedCount} users.`);
    }
  }

  // 2. Verify RLS (Public Access)
  console.log("\n--- 2. RLS Public Access Check (Areas) ---");
  const { data: areas, error: areasError } = await anonClient
    .from("areas")
    .select("*")
    .limit(1);

  if (areasError) {
    console.error("Error fetching areas as Anon:", areasError.message);
    console.log("❌ Public RLS for 'areas' might be broken or missing.");
  } else {
    console.log(`Successfully fetched ${areas.length} area(s) as Anon.`);
    console.log("✅ Public read access to 'areas' is working.");
  }

  // 3. Verify RLS (Protected Access)
  console.log("\n--- 3. RLS Protected Access Check (Assets) ---");
  const { data: assets, error: assetsError } = await anonClient
    .from("assets")
    .select("*")
    .limit(1);

  // If RLS is ON and configured for "authenticated only", this should return [] (empty) or error if no policy allows anon.
  // We expect empty array if policy is "TO authenticated USING (true)", or nothing if "Permitir lectura de assets a todos" does NOT exist.
  // Actually, if NO policy exists for Anon, it returns empty array (default deny) unless RLS is not enabled.
  // If RLS is DISABLED, it would return data. So if we get data, it's BAD (unless we want assets public).

  if (assetsError) {
    console.log("Note: Fetch error (could be expected):", assetsError.message);
  }

  if (assets && assets.length > 0) {
    // Check if RLS is actually enabled. If we get data, usage is questionable.
    // However, maybe RLS is NOT enabled?
    // We can't easily check if RLS is enabled via client, but finding data suggests either RLS is off OR there's a policy allowing Anon.
    console.log(
      "⚠️ WARNING: Fetched assets as Anon. Is RLS enabled on 'assets' table?"
    );
  } else {
    console.log(
      "✅ Assets query returned no data for Anon (Expected behavior)."
    );
  }
}

verifySystem().catch(console.error);
