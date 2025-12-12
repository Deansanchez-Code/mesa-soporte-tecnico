import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTests() {
  console.log("🚀 Starting Comprehensive System Verification Model M8...\n");
  let errors = 0;

  // TEST 1: Database Connection
  process.stdout.write("Test 1: Connecting to Database... ");
  const { error: connError } = await supabase
    .from("users")
    .select("count", { count: "exact", head: true });
  if (connError) {
    console.log("FAILED ❌");
    console.error(`Error: ${connError.message}`);
    errors++;
  } else {
    console.log("PASSED ✅");
  }

  // TEST 2: Schema Compatibility (Tickets)
  process.stdout.write("Test 2: Verifying 'tickets' schema compatibility... ");
  // We try to select the new columns. If they don't exist, this will query error.
  const { error: schemaError } = await supabase
    .from("tickets")
    .select("id, sla_status, sla_pause_reason")
    .limit(1);

  if (schemaError) {
    console.log("FAILED ❌");
    console.error(`Error: ${schemaError.message}. (Columns likely missing)`);
    errors++;
  } else {
    console.log("PASSED ✅");
  }

  // TEST 3: Schema Compatibility (Ticket Events)
  process.stdout.write(
    "Test 3: Verifying 'ticket_events' schema compatibility... "
  );
  const { error: eventsError } = await supabase
    .from("ticket_events")
    .select("id, action_type, old_value, new_value, comment, actor_id")
    .limit(1);

  if (eventsError) {
    console.log("FAILED ❌");
    console.error(`Error: ${eventsError.message}. (Table or columns missing)`);
    errors++;
  } else {
    console.log("PASSED ✅");
  }

  // TEST 4: Config Tables (Pause Reasons)
  process.stdout.write("Test 4: Verifying 'pause_reasons' configuration... ");
  const { data: reasons, error: reasonsError } = await supabase
    .from("pause_reasons")
    .select("*");

  if (reasonsError) {
    console.log("FAILED ❌");
    console.error(`Error: ${reasonsError.message}`);
    errors++;
  } else if (!reasons || reasons.length === 0) {
    console.log("WARNING ⚠️ (Table exists but empty)");
  } else {
    console.log(`PASSED ✅ (${reasons.length} reasons found)`);
  }

  // TEST 5: Category Config
  process.stdout.write("Test 5: Verifying 'ticket_categories_config'... ");
  const { data: cats, error: catError } = await supabase
    .from("ticket_categories_config")
    .select("*");

  if (catError) {
    console.log("FAILED ❌");
    errors++;
  } else {
    console.log(`PASSED ✅ (${cats?.length || 0} categories found)`);
  }

  console.log("\n---------------------------------------------------");
  if (errors === 0) {
    console.log(
      "🎉 ALL SYSTEMS GO. Database is compatible with refactored code."
    );
  } else {
    console.log(`⚠️ FOUND ${errors} ISSUES. Please review logs above.`);
  }
}

runTests().catch(console.error);
