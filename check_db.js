import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPending() {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, title, status, auditorium_id")
    .eq("auditorium_id", 3)
    .eq("status", "PENDING");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Pending Library Reservations (int 3):", data);
  }

  const { data: data2, error: error2 } = await supabase
    .from("reservations")
    .select("id, title, status, auditorium_id");

  if (!error2) {
    console.log("All reservations:", data2.slice(0, 5)); // show a few
  }
}

checkPending();
