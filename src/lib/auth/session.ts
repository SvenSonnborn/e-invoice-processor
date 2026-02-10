import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { prisma } from "@/src/lib/db/client";

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

/**
 * Get current user from database
 * Returns the user record from our database based on Supabase auth session
 */
export async function getCurrentUser() {
  const session = await getSession();
  
  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { supabaseUserId: session.user.id },
  });

  return user;
}

