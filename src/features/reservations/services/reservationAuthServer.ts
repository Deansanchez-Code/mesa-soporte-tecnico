import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildUserIdOrFilter, isValidUuid } from "@/lib/security";

/**
 * Resuelve el registro público en `public.users` del usuario autenticado
 * usando sesión por cookies o `accessToken` explícito de fallback.
 */
export async function resolveAuthenticatedPublicUser(accessToken?: string) {
  const supabase = await createClient();
  let authUser = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUser = user;
  } catch {
    authUser = null;
  }

  const adminSupabase = getSupabaseAdmin();
  if (!authUser && accessToken) {
    try {
      const { data: tokenData } = await adminSupabase.auth.getUser(accessToken);
      authUser = tokenData?.user || null;
    } catch {
      authUser = null;
    }
  }

  if (!authUser) return null;

  const userFilter = isValidUuid(authUser.id)
    ? buildUserIdOrFilter(authUser.id)
    : null;

  const userQuery = adminSupabase
    .from("users")
    .select(
      "id, full_name, role, username, job_category, is_vip, perm_manage_assignments, is_active",
    );

  const { data: publicUser } = userFilter
    ? await userQuery.or(userFilter).maybeSingle()
    : await userQuery.eq("auth_id", authUser.id).maybeSingle();

  if (!publicUser || publicUser.is_active === false) return null;

  return publicUser;
}

export async function broadcastSpaceReenabledNotifications(
  adminSupabase: ReturnType<typeof getSupabaseAdmin>,
  spaceName: string,
) {
  try {
    const { data: activeUsers } = await adminSupabase
      .from("users")
      .select("id")
      .or("is_active.eq.true,is_active.is.null");

    if (!activeUsers || activeUsers.length === 0) return;

    const notifications = activeUsers.map((u) => ({
      user_id: u.id,
      title: `¡Ambiente Habilitado: ${spaceName}!`,
      message: `Ya se encuentra habilitado el espacio ${spaceName} para realizar reservas y programación de eventos con normalidad.`,
    }));

    const chunkSize = 250;
    for (let i = 0; i < notifications.length; i += chunkSize) {
      await adminSupabase
        .from("user_notifications")
        .insert(notifications.slice(i, i + chunkSize));
    }
  } catch (err) {
    console.error("Error broadcasting space re-enabled notifications:", err);
  }
}
