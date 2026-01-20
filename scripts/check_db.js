const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value) process.env[key.trim()] = value.join("=").trim();
  });
}

loadEnv();

// Use SERVICE_ROLE_KEY to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function check() {
  console.log("--- Checking Database with Service Role ---");

  // 1. Check Reservations for Jan 29
  const { data: res, error: err } = await supabase
    .from("reservations")
    .select("*, users(full_name)")
    .gte("start_time", "2026-01-29T00:00:00")
    .lte("start_time", "2026-01-29T23:59:59");

  console.log("Reservations on Jan 29:", JSON.stringify(res, null, 2));
  if (err) console.error("Error fetching reservations:", err);

  // 2. Check Auditorium Areas
  const { data: areas } = await supabase
    .from("areas")
    .select("*")
    .ilike("name", "%AUDITORIO%");

  console.log("Auditorium Areas:", JSON.stringify(areas, null, 2));

  // 3. Find specific Jan 29 reservation if it exists anywhere
  const { data: findRes } = await supabase
    .from("reservations")
    .select("*, users(full_name)")
    .ilike("start_time", "%2026-01-29%");

  console.log("Fuzzy Search Jan 29:", JSON.stringify(findRes, null, 2));
}

check();
