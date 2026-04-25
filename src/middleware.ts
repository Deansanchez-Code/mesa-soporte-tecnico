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

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);

  // Security Headers
  // Content Security Policy (CSP)
  const supabaseUrl = "ukoqpikpqzffqieomaoo.supabase.co";
  const hashes = [
    "'sha256-OMTN3RiyGV48q7dfq7smzPajXInCCyET3nO2f/iyGm0='",
    "'sha256-IruqL+Rw2/gw9qcIEuVTtiQ6W/FT4P/h68AqpI1X5JA='",
    "'sha256-bZ66FjJw6gE5A6F5VF76R5WFPfgCUXQq1IWKo8MKo82s='",
    "'sha256-milqxmInn7vM++7+wQXZsRvJr3AyWwDmPSqjv/MA/r28='",
    "'sha256-Y91HmwHwj2+jCk0enBcIF22Zpjm3GhhlGQDTAgyfpzX4='",
    "'sha256-dvlHb+QYNRGgwSS8TPAL4he8zk2xs7hu8T6IRVnmSTE='",
  ].join(" ");

  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${hashes} https: http: ${
      process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in",
    "font-src 'self'",
    `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://${supabaseUrl} wss://${supabaseUrl} https://vitals.vercel-insights.com`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "block-all-mixed-content",
    "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");

  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, " ")
    .trim();

  // Apply headers to the response (whether it came from updateSession or next())
  const finalResponse =
    response ||
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  finalResponse.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicyHeaderValue,
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
