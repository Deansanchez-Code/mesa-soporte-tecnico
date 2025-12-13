import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing keys");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("Checking audit_logs with Service Role...");

  // 1. Check existence and count
  const { count, error } = await adminClient
    .from("audit_logs")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Service Role Error (Count):", error);
  } else {
    console.log(`Service Role Success: Found ${count} rows.`);
  }

  // 2. Check structure and basic select
  const { data: sample, error: sampleError } = await adminClient
    .from("audit_logs")
    .select("*")
    .limit(1);

  if (sampleError) {
    console.error("Sample Fetch Error:", sampleError);
  } else {
    console.log("Sample Data (Raw):", JSON.stringify(sample, null, 2));
  }

  // 3. Check Join with Users (as done in AuditTab)
  console.log("\nChecking Join with Users...");
  const { data: joinData, error: joinError } = await adminClient
    .from("audit_logs")
    .select("*, users(full_name, email)")
    .limit(1);

  if (joinError) {
    console.error("Join Error:", joinError);
  } else {
    console.log("Join Success:", JSON.stringify(joinData, null, 2));
  }
}

check();
