import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client
 *
 * Use this in Client Components only.
 * Env vars are inlined at build time via NEXT_PUBLIC_*.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

