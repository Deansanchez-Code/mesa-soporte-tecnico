import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Only for creating test user

if (!supabaseUrl || !supabaseKey || !serviceKey) {
  console.error("❌ Missing env vars (Need URL, ANON_KEY, SERVICE_ROLE_KEY)");
  process.exit(1);
}

// 1. Admin Client (to create a test user)
const admin = createClient(supabaseUrl!, serviceKey!);
// 2. Regular Client (to test RLS)
const client = createClient(supabaseUrl!, supabaseKey!);

async function verifyDeployment() {
  console.log("🔍 Verifying Security Patches...");

  const testEmail = `audit_${Date.now()}@example.com`;
  const testPass = "AuditPass123!";
  let userId = "";

  try {
    // A. Verify User Creation Logic (Ghost User Fix)
    console.log("\n1️⃣  Testing User Creation (Anti-Ghost Check)...");
    const { data: authUser, error: createError } =
      await admin.auth.admin.createUser({
        email: testEmail,
        password: testPass,
        email_confirm: true,
        user_metadata: {
          full_name: "Audit User",
          role: "agent",
          area: "Audit Dept",
          perm_create_assets: true, // Boolean check
        },
      });

    if (createError) throw createError;
    userId = authUser.user?.id || "";

    // Check immediate availability in Public Table (without waiting)
    const { data: publicUser, error: fetchError } = await admin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !publicUser) {
      console.error(
        "❌ FAILED: Public user not found immediately after Auth creation.",
      );
      console.error(
        "   Reason: Trigger 'handle_new_user' might be missing or broken.",
      );
    } else {
      console.log("✅ SUCCESS: User synced immediately.");

      // Verify metadata mapping
      if (
        publicUser.role === "agent" &&
        publicUser.area === "Audit Dept" &&
        publicUser.perm_create_assets === true
      ) {
        console.log(
          "✅ SUCCESS: Metadata correctly mapped (Role, Area, Permissions).",
        );
      } else {
        console.error("❌ FAILED: Metadata mismatch.", publicUser);
        console.error("   Reason: Trigger is flawed (Old version?).");
      }
    }

    // B. Verify RLS on Assets
    console.log("\n2️⃣  Testing Asset Security (RLS Check)...");

    // Login as the new test user
    const {
      data: { session },
      error: loginError,
    } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPass,
    });

    if (loginError) throw loginError;

    // Try to read ALL assets
    // Try to read ALL assets
    const authenticatedClient = createClient(supabaseUrl!, supabaseKey!, {
      global: { headers: { Authorization: `Bearer ${session?.access_token}` } },
    });

    const { error: rlsError } = await authenticatedClient
      .from("assets")
      .select("id")
      .limit(5);

    if (rlsError) {
      console.log(
        "ℹ️  RLS prevented access (Good?) or Error:",
        rlsError.message,
      );
    } else {
      // Using 'agent' role, they might have access if policy says "Staff can see all"
      // Let's create a dummy asset assigned to someone else
      await admin
        .from("assets")
        .insert({
          model: "Secret Prototype",
          serial_number: "SECRET-001",
          type: "laptop",
          status: "active",
          location: "Vault",
          // Not assigned to our user
        })
        .select()
        .single();

      const { data: readAttempt } = await authenticatedClient
        .from("assets")
        .select("id")
        .eq("serial_number", "SECRET-001");

      // If our role is 'agent', we might expect access depending on business logic.
      // If business logic says "Agents see all", then access is OK.
      // Let's assume we want to enforce checking correct mapping.

      console.log(
        `ℹ️  Access result for ${testEmail} (Role: agent):`,
        readAttempt?.length ? "ALLOWED" : "DENIED",
      );
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("❌ FATAL ERROR:", message);
  } finally {
    // Cleanup
    if (userId) {
      console.log("\n🧹 Cleaning up test user...");
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

verifyDeployment();
