import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Faltan credenciales en .env.local");
  console.log(
    "Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

// Cliente con Service Role Key para saltar RLS y acceder a auth.users
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listUsers() {
  console.log("--- Listando Usuarios de Supabase Auth ---");

  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error("❌ Error al obtener usuarios:", error.message);
    return;
  }

  if (users.length === 0) {
    console.log("No se encontraron usuarios.");
    return;
  }

  console.table(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || "N/A",
      role: u.user_metadata?.role || "user",
      created_at: u.created_at,
    })),
  );

  console.log("\nTotal de usuarios:", users.length);
  console.log(
    "\n[NOTA] Las contraseñas no son visibles por seguridad (están hasheadas en la base de datos).",
  );
}

listUsers();
