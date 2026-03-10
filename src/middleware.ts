import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Exclude public assets, api routes (handled internally), and static files
  if (
    request.nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|json)$/)
  ) {
    return;
  }

  // PUBLIC API ROUTES WHITELIST
  const publicApiRoutes = [
    "/api/auth/register-contractor",
    "/api/auth/check-user", // Added to allow login check
    "/api/auth/callback", // If you use OAuth
  ];

  if (
    publicApiRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  const response = await updateSession(request);

  // Security Headers
  // Content Security Policy (CSP)
  // Note: 'unsafe-inline' and 'unsafe-eval' are currently allowed for Next.js hydration and some libraries.
  // Ideally, we would use nonces, but that requires more complex setup with Next.js App Router.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com;
    connect-src 'self' https://*.supabase.co https://*.supabase.in;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in;
    font-src 'self';
    connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Apply headers to the response (whether it came from updateSession or next())
  const finalResponse = response || NextResponse.next();

  finalResponse.headers.set(
    "Content-Security-Policy",
    cspHeader.replace(/\s{2,}/g, " ").trim(),
  );

  finalResponse.headers.set("X-Content-Type-Options", "nosniff");
  finalResponse.headers.set("X-Frame-Options", "DENY");
  finalResponse.headers.set("X-XSS-Protection", "1; mode=block");
  finalResponse.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );
  finalResponse.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return finalResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes are protected separately)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
