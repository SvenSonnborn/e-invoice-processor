import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Session Management
 * Helper functions for retrieving and managing user sessions via Supabase Auth.
 */

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data;
}

export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

