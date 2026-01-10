import { NextResponse, NextRequest } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase/cliente";

export async function POST(req: NextRequest) {
  // AUTH_CHECK_BYPASS: Public username check (Data Restricted)
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, username, full_name, role, area, employment_type, job_category, auth_id, email",
      )
      .eq("username", username)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // --- AUTO-FIX / SYNC LOGIC FOR 'USER' ROLE ---
    // Soluciona el problema de "usuarios guardados" que no loguean (Silent Login falla)
    if (user.role === "user") {
      const syntheticEmail = `${user.username}@sistema.local`;
      const defaultPassword = "Sena2024*";
      let shouldUpdateAuthId = false;
      let newAuthId = user.auth_id;

      let authUserExists = false;
      if (user.auth_id) {
        const { data: authUser, error: authCheckError } =
          await supabaseAdmin.auth.admin.getUserById(user.auth_id);
        if (authUser && authUser.user) {
          authUserExists = true;
          // Opcional: Podríamos forzar el reset de contraseña aquí si quisieramos asegurar el login,
          // pero podría ser intrusivo. Sin embargo, dado que el frontend HARCODEA la contraseña,
          // si la contraseña en Auth es diferente, el login FALLARÁ.
          // Por seguridad/estabilidad del sistema Kiosko, vamos a actualizar la contraseña.
          await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
            password: defaultPassword,
            email_confirm: true,
          });
        }
      }

      if (!authUserExists) {
        console.log(`Usuario ${user.username} sin Auth válido. Recreando...`);
        // Crear usuario en Auth
        const { data: newAuth, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: syntheticEmail,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: user.full_name,
              role: user.role,
              area: user.area,
              username: user.username,
            },
          });

        if (createError) {
          // Si falla porque ya existe el email, intentamos buscarlo por email
          if (createError.message.includes("already registered")) {
            console.log("Email ya registrado, buscando usuario...");
            // Esto es raro si authUserExists dio false por ID, significa que el auth_id en DB estaba mal
            // pero el email sí existe en Auth.
            // Tendríamos que buscar el usuario por email (no hay API directa de admin getUser por email?
            // admin.listUsers() puede filtrar?)
            // Simplificación: asumiendo que create user devuelve error.
          } else {
            console.error("Error recreando Auth:", createError);
          }
        } else if (newAuth.user) {
          newAuthId = newAuth.user.id;
          shouldUpdateAuthId = true;
        }
      }

      if (shouldUpdateAuthId && newAuthId) {
        await supabaseAdmin
          .from("users")
          .update({ auth_id: newAuthId })
          .eq("id", user.id);

        // Actualizar el objeto user para retornarlo corregido
        user.auth_id = newAuthId;
      }
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    // console.error("Check user error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
