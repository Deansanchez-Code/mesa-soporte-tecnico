import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need SERVICE_ROLE_KEY to execute DDL (Administrative tasks)
// Attempting to read it from .env.local, usually named SUPABASE_SERVICE_ROLE_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase URL or Service Role Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const migrationFiles = [
  "database/migrations/20251208_add_ticket_types_and_sla.sql",
  "database/migrations/20251208_create_ticket_audit.sql",
  "database/migrations/20251208_create_pause_reasons.sql",
  "database/seed_categories.sql",
  "database/functions/sla_logic.sql",
];

async function applyMigrations() {
  console.log("🚀 Starting Database Migration...");

  for (const file of migrationFiles) {
    const filePath = path.resolve(__dirname, "../", file);
    console.log(`\n📂 Processing: ${file}`);

    try {
      const sql = fs.readFileSync(filePath, "utf8");

      // Execute SQL via RPC or raw query if available.
      // Supabase JS client doesn't support raw SQL directly on client-side easily without a function.
      // HOWEVER, we can use the pg driver approach OR assume the user has a 'exec_sql' function exposed.
      // If not, we might fail.

      // STRATEGY B: Check if there's a REST API endpoint we can use, OR
      // Since we are in an agent environment, we might want to try to use a postgres connection if available.
      // BUT, given the environment context, let's try to assume there is an `exec_sql` function
      // OR just guide the user.

      // Let's try attempting to run it via a direct postgres connection might be better?
      // No, we don't have the connection string, only the URL/Key.

      // Fallback: We will try to rely on a remote procedure call if exists, otherwise we warn.
      // Actually, often agents have access to the dashboard. But here we must code it.

      // Let's try to use the `users` table check as a "ping" and then just print the SQL requires manual run
      // IF we cant execute.
      // WAIT, `system_audit.ts` was used in previous turns. Let's see how it accessed DB.
      // It used `supabase` client.

      // NOTE: Executing RAW SQL from the JS client requires a postgres function "exec_sql" or similar
      // to be present in the public schema, OR using the `pg` library if we have the connection string.
      // I will assume for now that I need to provide the SQL to the user or try to find a way.

      // HACK: I will attempt to "Create" the function via a specific known hack or just ask the user
      // to run these in the Supabase SQL Editor if this script fails.

      console.log(
        "⚠️ NOTICE: For security, Supabase-js cannot execute raw DDL directly without a helper function."
      );
      console.log(
        "   Please run the contents of this file in your Supabase SQL Editor."
      );
      console.log(`   File content preview: ${sql.substring(0, 50)}...`);
    } catch (err) {
      console.error(`❌ Error reading file ${file}:`, err);
    }
  }

  console.log("\n✅ Migration Script Finished (Check logs above).");
}

applyMigrations();
