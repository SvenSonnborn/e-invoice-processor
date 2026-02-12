import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { prisma } from '@/src/lib/db/client';

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
    redirect('/login');
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

/**
 * Auth guard for API routes.
 * Returns the authenticated database user or a 401 JSON response.
 *
 * Usage in route handlers:
 *   const result = await requireApiAuth();
 *   if (result instanceof NextResponse) return result;
 *   const user = result;
 */
export async function requireApiAuth() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return user;
}

/**
 * Auth guard for API routes that also requires org membership.
 * Returns { user, organizationId } or a 401/403 JSON response.
 */
export async function requireApiAuthWithOrg() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: 'No organization membership' },
      { status: 403 }
    );
  }

  return { user, organizationId: membership.organizationId };
}
