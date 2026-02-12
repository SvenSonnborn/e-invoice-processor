import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { prisma } from '@/src/lib/db/client';
import { ApiError } from '@/src/lib/errors/api-error';
import type { User } from '@/src/generated/prisma/client';

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
 * Get current user from database.
 * Returns the user record from our database based on Supabase auth session, or null.
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
 * API auth guard — returns the authenticated database user or throws ApiError.
 *
 * Usage:
 *   const user = await getMyUserOrThrow();
 *
 * @throws {ApiError} UNAUTHENTICATED if no session or no database user
 */
export async function getMyUserOrThrow(): Promise<User> {
  const session = await getSession();

  if (!session?.user) {
    throw ApiError.unauthenticated();
  }

  const user = await prisma.user.findUnique({
    where: { supabaseUserId: session.user.id },
  });

  if (!user) {
    throw ApiError.unauthenticated('User not found in database');
  }

  return user;
}

/**
 * API auth + org guard — returns authenticated user and their active organization ID, or throws.
 *
 * Resolution order for organization:
 *   1. `active-org-id` cookie (if set and user has membership)
 *   2. First membership (fallback)
 *
 * Usage:
 *   const { user, organizationId } = await getMyOrganizationIdOrThrow();
 *
 * @throws {ApiError} UNAUTHENTICATED if no session or no database user
 * @throws {ApiError} NO_ORGANIZATION if user has no organization membership
 */
export async function getMyOrganizationIdOrThrow(): Promise<{
  user: User;
  organizationId: string;
}> {
  const user = await getMyUserOrThrow();

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get('active-org-id')?.value;

  // If cookie is set, verify user actually has access to that org
  if (activeOrgId) {
    const activeMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: activeOrgId,
        },
      },
      select: { organizationId: true },
    });

    if (activeMembership) {
      return { user, organizationId: activeMembership.organizationId };
    }
  }

  // Fallback: first membership
  const firstMembership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!firstMembership) {
    throw ApiError.noOrganization();
  }

  return { user, organizationId: firstMembership.organizationId };
}
