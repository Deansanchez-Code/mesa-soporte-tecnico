import dotenv from "dotenv";
dotenv.config({ path: ".env.local", debug: false });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedSuperAdmin() {
  const username = "deansan"; // Lowercase for consistency
  const password = "80854269***"; // As requested
  const fullName = "Ing. Deivis Andres Sanchez H.";
  const role = "admin";
  const area = "Dirección TIC"; // Assuming an area

  // Check if exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (existing) {
    console.log("Updating existing Super Admin...");
    const { error } = await supabase
      .from("users")
      .update({
        full_name: fullName,
        password: password,
        role: role,
        area: area,
      })
      .eq("id", existing.id);

    if (error) console.error("Update failed:", error);
    else console.log("Super Admin updated successfully.");
  } else {
    console.log("Creating new Super Admin...");
    const { error } = await supabase.from("users").insert({
      username: username,
      full_name: fullName,
      password: password,
      role: role,
      area: area,
    });

    if (error) console.error("Creation failed:", error);
    else console.log("Super Admin created successfully.");
  }
}

seedSuperAdmin();
