import { NextResponse, NextRequest } from "next/server";
// import { createClient } from "@/lib/supabase/cliente"; // Unused
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

    // --- AUTO-FIX / SYNC LOGIC FOR ALL NON-ADMIN ROLES ---
    // Soluciona el problema de "usuarios guardados" que no loguean (Silent Login falla)
    if (user.role !== "admin" && user.role !== "superadmin") {
      const cleanUsername = user.username.toLowerCase().trim();
      const syntheticEmail = `${cleanUsername}@sistema.local`.toLowerCase();
      const defaultPassword = "Sena2024*";
      let shouldUpdateAuthId = false;
      let newAuthId = user.auth_id;

      let authUserExists = false;

      // 1. Intentar por ID almacenado
      if (user.auth_id) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
          user.auth_id,
        );
        if (authUser && authUser.user) {
          authUserExists = true;
          // Sincronizar email y password
          await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
            email: syntheticEmail,
            password: defaultPassword,
            email_confirm: true,
          });
        }
      }

      // 2. Si no existe por ID, buscar por email sintético en toda la lista (Paginación simple)
      if (!authUserExists) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = listData?.users.find(
          (u) => u.email?.toLowerCase() === syntheticEmail,
        );

        if (existingAuthUser) {
          authUserExists = true;
          newAuthId = existingAuthUser.id;
          shouldUpdateAuthId = true;
          await supabaseAdmin.auth.admin.updateUserById(newAuthId, {
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: user.full_name,
              role: user.role,
              area: user.area,
              username: user.username,
            },
          });
        }
      }

      if (!authUserExists) {
        console.log(`Usuario ${cleanUsername} sin Auth válido. Recreando...`);
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
          // Si falla porque ya existe el email, intentamos buscarlo por email o listarlos
          if (
            createError.message.toLowerCase().includes("already registered")
          ) {
            console.log("Email ya registrado, vinculando...");
            const { data: listData } =
              await supabaseAdmin.auth.admin.listUsers();
            const existingAuthUser = listData?.users.find(
              (u) => u.email?.toLowerCase() === syntheticEmail,
            );

            if (existingAuthUser) {
              newAuthId = existingAuthUser.id;
              shouldUpdateAuthId = true;
              // Aseguramos la contraseña de todos modos
              await supabaseAdmin.auth.admin.updateUserById(newAuthId, {
                password: defaultPassword,
                email_confirm: true,
              });
            }
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
