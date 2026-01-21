const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.join("=").trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error("Please provide SQL file path");
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log(`Applying migration from ${sqlPath}...`);

  // Use rpc calls if available, or just raw query if pg library was used.
  // Supabase JS client doesn't support raw SQL easily unless via an RPC function that executes SQL,
  // or if we use the Postgres connection string.

  // Since we don't have a generic "exec_sql" RPC function exposed (usually), we might be stuck.
  // BUT, usually these projects have a generic query runner or we just use the `pg` driver directly.
  // Let's assume there is NO direct way via supabase-js unless we have an RPC.

  // WORKAROUND: If "exec_sql" or similar exists, use it.
  // OTHERWISE: We must notify the user to run it in SQL Editor.

  // Attempt to call a likely existing RPC function 'exec_sql' or 'exec'
  const { error } = await supabase.rpc("exec_sql", { query: sql });

  if (error) {
    console.error("RPC exec_sql failed:", error);
    console.log(
      "Attempting creating function via direct query is not supported by supabase-js client directly without an RPC.",
    );
    console.log(
      "Please run the SQL manually in Supabase Dashboard SQL Editor.",
    );
    process.exit(1);
  } else {
    console.log("Migration applied successfully via RPC!");
  }
}

applyMigration();
