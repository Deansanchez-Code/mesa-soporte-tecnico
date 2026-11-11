import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { buildUserIdOrFilter, isValidUuid } from "@/lib/security";

const ALLOWED_PERMISSION_COLUMNS = new Set([
  "perm_manage_assignments",
  "perm_create_assets",
  "perm_transfer_assets",
  "perm_decommission_assets",
]);

// Helper to create a response with a JSON error
export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Validates that the request has a valid Supabase session (Bearer token or SSR cookie).
 * Returns the user object if valid, or null if invalid.
 */
export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && user) {
        return user;
      }
    }
  }

  try {
    const ssrClient = await createServerClient();
    const {
      data: { user },
      error,
    } = await ssrClient.auth.getUser();
    if (!error && user) return user;
  } catch {
    return null;
  }

  return null;
}

/**
 * Checks if the active user has one of the allowed roles OR specific permissions.
 */
export async function verifyUserPermissions(
  userId: string,
  requiredRoles: string[] = [],
  requiredPermissionColumn?: string,
) {
  if (!isValidUuid(userId) || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  const safePermCol =
    requiredPermissionColumn &&
    ALLOWED_PERMISSION_COLUMNS.has(requiredPermissionColumn)
      ? requiredPermissionColumn
      : undefined;

  const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const selectColumns = safePermCol
    ? `role, job_category, username, is_vip, is_active, ${safePermCol}`
    : "role, job_category, username, is_vip, is_active";

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(selectColumns)
    .or(buildUserIdOrFilter(userId))
    .maybeSingle();

  const userProfile = data as Record<string, unknown> | null;

  if (error || !userProfile) return false;
  // ISO 27001 A.5.18: Usuarios desactivados no conservan privilegios
  if (userProfile.is_active === false) return false;

  // 1. Check Role
  const roleLower = String(userProfile.role || "").toLowerCase();
  if (requiredRoles.some((r) => r.toLowerCase() === roleLower)) return true;

  // 2. Check Permission Column (allowlisted)
  if (safePermCol) {
    if (userProfile[safePermCol] === true) return true;

    // Coordinators also have assignment management privileges
    if (safePermCol === "perm_manage_assignments") {
      const jobCat = String(userProfile.job_category || "").toLowerCase();
      const uname = String(userProfile.username || "")
        .toLowerCase()
        .trim();
      if (
        jobCat === "coordinador" ||
        roleLower === "coordinator" ||
        Boolean(userProfile.is_vip) ||
        ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].includes(
          uname,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}
