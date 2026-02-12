import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Routes that require an authenticated session.
 * Unauthenticated users hitting these paths are redirected to /login.
 */
const PROTECTED_PATHS = ['/dashboard', '/invoices', '/exports', '/settings'];

/**
 * Next.js Middleware
 *
 * 1. Refreshes the Supabase JWT on every request (pages + API routes)
 *    so that Server Components, Server Actions and API route handlers
 *    always have a fresh session available via cookies.
 *
 * 2. Redirects unauthenticated users to /login when they hit protected
 *    page routes (dashboard, invoices, etc.).
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
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Validate and refresh the JWT. getUser() verifies the token server-side
  // and triggers a token refresh if the access token has expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected page routes.
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except static assets.
    // API routes are now included so their JWTs get refreshed too.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
