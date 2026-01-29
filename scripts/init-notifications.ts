import { getSupabaseAdmin } from "../src/lib/supabase/admin";

async function initNotificationsTable() {
  const supabase = getSupabaseAdmin();

  console.log("Checking for user_notifications table...");

  // Supabase doesn't support easy 'create table' via client without RPC or raw SQL
  // We will attempt a dummy query to check if it exists, if not, we instruct the user
  // or use an RPC if available.

  const { error } = await supabase
    .from("user_notifications")
    .select("id")
    .limit(1);

  if (
    (error && error.code === "PGRST116") ||
    error?.message?.includes("does not exist")
  ) {
    console.log("Table 'user_notifications' not found.");
    console.log("Please run the following SQL in your Supabase SQL Editor:");
    console.log(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );

      ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Users can see their own notifications" 
      ON user_notifications FOR SELECT 
      USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
    `);
  } else {
    console.log("Table 'user_notifications' already exists or is accessible.");
  }
}

initNotificationsTable().catch(console.error);
