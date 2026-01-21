const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Helper to parse .env.local
function getEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  content.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      env[key.trim()] = rest.join("=").trim();
    }
  });
  return env;
}

const env = getEnv();
const connectionString = env.DATABASE_URL || env.POSTGRES_URL;

if (!connectionString) {
  console.error("No DATABASE_URL or POSTGRES_URL found in .env.local");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }, // Required for Supabase in many environments
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB. Running fix...");

    const sql = fs.readFileSync(
      "scripts/database/fix_trigger_priority.sql",
      "utf8",
    );
    await client.query(sql);

    console.log("✅ Trigger function fixed successfully!");
  } catch (err) {
    console.error("Error executing SQL:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
