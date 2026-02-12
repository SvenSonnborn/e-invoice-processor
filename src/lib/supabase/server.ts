import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase server client (Server Components, Server Actions, Route Handlers)
 *
 * This client is configured to read/write auth cookies via Next.js `cookies()`.
 * Uses the newer @supabase/ssr 0.8+ API with getAll/setAll.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Component where cookies cannot be set.
            // This can be ignored if middleware refreshes the session.
          }
        },
      },
    }
  );
}
