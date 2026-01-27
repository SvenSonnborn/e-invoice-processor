import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Next.js Middleware
 *
 * Keeps the Supabase auth session fresh on each request by validating and
 * refreshing JWTs via `auth.getClaims()`. This makes SSR-safe access to the
 * current user possible in Server Components, Server Actions and API routes.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Validate and refresh the JWT. This must be called for the middleware to
  // keep cookies in sync with Supabase auth.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except for API routes and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

