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

  // PROTEGER CONTRA TIMEOUTS EN VERCEL EDGE (Timeout de 2.5s)
  let user = null;
  try {
    const userPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>(
      (_, reject) =>
        setTimeout(
          () => reject(new Error("Supabase auth timeout in middleware")),
          2500,
        ),
    );

    const result = await Promise.race([userPromise, timeoutPromise]);
    user = result.data.user;
  } catch (err) {
    console.warn("⚠️ Middleware auth check warning / timeout:", err);
    // Si hay timeout o error de red hacia Supabase, dejamos continuar la petición
    // para que AuthGuard en cliente o los Server Components manejen la autenticación
    return supabaseResponse;
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/test-email") &&
    !request.nextUrl.pathname.startsWith("/public-portal") &&
    request.nextUrl.pathname !== "/"
  ) {
    // SECURITY: Handle API calls differently (JSON 401 instead of Redirect)
    if (request.nextUrl.pathname.startsWith("/api")) {
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

  // If user is logged in and visits login page, redirect according to role
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const role = user.user_metadata?.role || "user";
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
