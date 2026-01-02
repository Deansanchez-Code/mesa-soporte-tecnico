import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Helper to create a response with a JSON error
export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Validates that the request has a valid Supabase session.
 * Returns the user object if valid, or null if invalid.
 * NOTE: This relies on the Authorization header (Bearer token) passed from the client.
 */
export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");

  // Verify token using a fresh client or just getUser which verifies the JWT signature
  // We use a clean client to ensure we aren't using the Admin Service Role for verification
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Checks if the user has one of the allowed roles OR specific permissions.
 */
export async function verifyUserPermissions(
  userId: string,
  requiredRoles: string[] = [],
  requiredPermissionColumn?: string,
) {
  // We need the admin client to check public.users permissions reliably
  // (since RLS might restrict what a user can see about themselves if not careful, though usually they can see self)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const query = supabaseAdmin
    .from("users")
    .select(`role, ${requiredPermissionColumn || "id"}`)
    .eq("id", userId)
    .single();

  const { data: userProfile, error } = await query;

  if (error || !userProfile) return false;

  // 1. Check Role
  if (requiredRoles.includes(userProfile.role)) return true;

  // 2. Check Permission Column (if provided)
  // Dynamic access: userProfile['perm_manage_assignments']
  if (
    requiredPermissionColumn &&
    (userProfile as unknown as Record<string, unknown>)[
      requiredPermissionColumn
    ] === true
  ) {
    return true;
  }

  return false;
}
