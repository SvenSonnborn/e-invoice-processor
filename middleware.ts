import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware
 * Handles authentication, rate limiting, and other cross-cutting concerns
 */

export function middleware(_request: NextRequest) {
  // TODO: Implement middleware logic
  // - Authentication checks
  // - Rate limiting
  // - Request logging
  // - CORS headers

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
