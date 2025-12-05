/* eslint-disable */
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Error: Missing env variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateUsers() {
  console.log("🚀 Starting User Migration to Supabase Auth...");

  // 1. Fetch all users from public table
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .is("auth_id", null); // Only migrate users who haven't been migrated yet

  if (error) {
    console.error("❌ Error fetching users:", error);
    return;
  }

  console.log(`📋 Found ${users.length} users to migrate.`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const syntheticEmail = `${user.username}@sistema.local`;
    console.log(`Processing: ${user.username} -> ${syntheticEmail}`);

    try {
      // 2. Create user in Supabase Auth
      // We use 'admin.createUser' to bypass email confirmation and set password directly
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email: syntheticEmail,
          password: user.password, // Migrating existing password
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
            role: user.role,
            area: user.area,
          },
        });

      if (authError) {
        // If user already exists, try to get their ID (maybe run previously)
        if (authError.message.includes("already registered")) {
          console.warn(`⚠️ User ${user.username} already in Auth. Linking...`);
          // We need to find the user ID. Since we can't search by email easily with admin API without listing all,
          // we'll assume we can skip or handle manually. For now, let's log.
          // Actually, we can try to list users or just skip.
          // Let's try to fetch the user by email to link them.
          const { data: listUsers } = await supabase.auth.admin.listUsers();
          const existing = listUsers.users.find(
            (u) => u.email === syntheticEmail
          );

          if (existing) {
            // 3. Update public.users with auth_id
            const { error: updateError } = await supabase
              .from("users")
              .update({ auth_id: existing.id, email: syntheticEmail })
              .eq("id", user.id);

            if (updateError) throw updateError;
            console.log(`✅ Linked existing Auth user for: ${user.username}`);
            successCount++;
            continue;
          }
        }
        throw authError;
      }

      if (!authUser.user) throw new Error("No user returned from create");

      // 3. Update public.users with auth_id
      const { error: updateError } = await supabase
        .from("users")
        .update({ auth_id: authUser.user.id, email: syntheticEmail })
        .eq("id", user.id);

      if (updateError) {
        // Rollback: Delete auth user if DB update fails (optional, but good practice)
        await supabase.auth.admin.deleteUser(authUser.user.id);
        throw updateError;
      }

      console.log(`✅ Migrated: ${user.username}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to migrate ${user.username}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n🏁 Migration Complete.`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
}

migrateUsers();
