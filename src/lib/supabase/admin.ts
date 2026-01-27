import { createClient } from "@supabase/supabase-js";
import { env } from "@/src/lib/config/env";

/**
 * Supabase admin client (service role)
 *
 * Uses the highly-privileged service role key. MUST only be used on the server
 * for backend tasks like Storage operations, RLS management, and background jobs.
 */
export const supabaseAdminClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

