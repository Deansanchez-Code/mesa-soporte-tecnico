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

async function seed() {
  console.log("🌱 Seeding Audit Logs...");

  // 1. Get a valid user (admin preferred)
  const { data: users, error: userError } = await adminClient
    .from("users")
    .select("id, full_name")
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error("No users found to assign logs to.");
    return;
  }

  const actor = users[0];
  console.log(`Assigning logs to: ${actor.full_name} (${actor.id})`);

  // 2. Insert dummy logs
  const logs = [
    {
      actor_id: actor.id,
      action: "LOGIN",
      resource: "auth",
      resource_id: "session",
      details: { method: "password", ip: "127.0.0.1" },
    },
    {
      actor_id: actor.id,
      action: "CREATE_TICKET",
      resource: "tickets",
      resource_id: "101",
      details: { category: "Hardware", priority: "High" },
    },
    {
      actor_id: actor.id,
      action: "UPDATE_STATUS",
      resource: "tickets",
      resource_id: "101",
      details: { old: "OPEN", new: "IN_PROGRESS" },
    },
  ];

  const { error: insertError } = await adminClient
    .from("audit_logs")
    .insert(logs);

  if (insertError) {
    console.error("❌ Insert Failed:", insertError);
    if (insertError.message.includes("foreign key constraint")) {
      console.error(
        "👉 CAUSE: The Foreign Key is still missing. Please run the SQL script first!",
      );
    }
  } else {
    console.log("✅ Seed Success: Inserted 3 audit logs.");
  }
}

seed();
