/* eslint-disable */
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Falta configuración de entorno (URL o Service Key)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUserFlow() {
  console.log("🧪 Iniciando Prueba de Lógica de Usuarios...");

  const testEmail = `test.auto.${Date.now()}@sistema.local`;
  const testPassword = "TestPassword123!";

  // 1. CREATE
  console.log(`\n1. Creando usuario de prueba: ${testEmail}`);
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Test User", role: "user" },
    });

  if (authError) {
    console.error("❌ Error creando Auth:", authError.message);
    return;
  }
  const userId = authData.user.id;
  console.log("✅ Usuario Auth creado. ID:", userId);

  // 2. INSERT PROFILE (Simulating API)
  console.log("   Insertando perfil en public.users...");
  const { error: profileError } = await supabase.from("users").insert({
    id: userId,
    auth_id: userId,
    email: testEmail,
    full_name: "Test User Auto",
    username: "test.auto",
    role: "user",
    area: "Mesa de Ayuda",
    is_active: true,
  });

  if (profileError) {
    console.error("❌ Error creando perfil:", profileError.message);
    // Cleanup
    await supabase.auth.admin.deleteUser(userId);
    return;
  }
  console.log("✅ Perfil creado correctamente.");

  // 3. DATABASE CHECK (Column deleted_at)
  console.log("\n2. Verificando esquema (columna deleted_at)...");
  // Try to select deleted_at. If it fails, column doesn't exist.
  const { error: colError } = await supabase
    .from("users")
    .select("deleted_at")
    .eq("id", userId)
    .single();

  if (colError) {
    console.error(
      "⚠️  ALERTA: Parece que la columna 'deleted_at' NO existe o no es accesible."
    );
    console.error("   Detalle:", colError.message);
    console.log(
      "   >> Por favor ejecuta el script SQL 'add_deleted_at.sql' <<"
    );
  } else {
    console.log("✅ Columna 'deleted_at' detectada.");
  }

  // 4. SOFT DELETE
  console.log(`\n3. Probando Baja Lógica (Soft Delete) para: ${userId}`);

  // Update DB
  const { error: updateError } = await supabase
    .from("users")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error(
      "❌ Falló el update de Soft Delete en DB:",
      updateError.message
    );
  } else {
    console.log("✅ DB Update exitoso (is_active=false, deleted_at=set).");
  }

  // Ban User
  const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "100h",
  });

  if (banError) {
    console.error("❌ Falló el ban en Auth:", banError.message);
  } else {
    console.log("✅ Usuario bloqueado en Auth correctamente.");
  }

  // 5. VERIFY LOGIN FAILURE (Optional simulation)
  console.log("\n4. Verificando bloqueo de acceso...");
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError && loginError.message.includes("Invalid login")) {
    // Note: Ban usually results in "Invalid login credentials" or specific ban message depending on config
    console.log("✅ Login rechazado (Esperado). Mensaje:", loginError.message);
  } else if (!loginError) {
    console.error("❌ EL USUARIO PUDO INICIAR SESIÓN (El bloqueo falló).");
  } else {
    console.log("✅ Login falló con:", loginError.message);
  }

  console.log("\n🏁 Prueba finalizada.");
}

testUserFlow();
