import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service key for admin updates

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase Service Key or URL");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log("Updating deansan password to 'Sena2024*'...");

  // 1. Get User ID by email (synthetic)
  const {
    data: { users },
    error: listError,
  } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    console.error("List users failed:", listError);
    return;
  }

  const deansan = users.find((u) => u.email === "deansan@sistema.local");

  if (!deansan) {
    console.error("User deansan@sistema.local not found!");
    return;
  }

  // 2. Update Password
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    deansan.id,
    { password: "Sena2024*" },
  );

  if (error) {
    console.error("Update failed:", error);
  } else {
    console.log("✅ Password updated successfully for:", data.user.email);
  }
}

main();
