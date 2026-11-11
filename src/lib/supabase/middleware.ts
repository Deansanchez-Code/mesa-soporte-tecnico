import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders || request.headers,
    },
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders || request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // PROTEGER CONTRA TIMEOUTS EN VERCEL EDGE (Timeout de 3.5s)
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/public-portal") ||
    pathname === "/";

  let user = null;
  let authFailed = false;
  try {
    const userPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>(
      (_, reject) =>
        setTimeout(
          () => reject(new Error("Supabase auth timeout in middleware")),
          3500,
        ),
    );

    const result = await Promise.race([userPromise, timeoutPromise]);
    user = result.data.user;
  } catch (err) {
    console.warn("⚠️ Middleware auth check warning / timeout:", err);
    authFailed = true;
  }

  // ISO 27001 A.8.20 / Fail-closed en rutas protegidas ante fallo de verificación
  if (authFailed && !isPublicRoute) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized: Session verification failed" },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicRoute) {
    // SECURITY: Handle API calls differently (JSON 401 instead of Redirect)
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized: Session required" },
        { status: 401 },
      );
    }

    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is logged in and visits login page, redirect using authoritative DB role (never user_metadata)
  if (user && pathname.startsWith("/login")) {
    let role = "user";
    try {
      const { data: publicUser } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (publicUser?.role) {
        role = String(publicUser.role).toLowerCase();
      }
    } catch {
      role = "user";
    }
    const url = request.nextUrl.clone();

    if (role === "admin" || role === "superadmin") {
      url.pathname = "/admin";
    } else {
      url.pathname = "/dashboard";
    }

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
