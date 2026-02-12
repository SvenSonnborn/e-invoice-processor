'use server';

import { requireAuth } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/client';
import { Prisma } from '@/src/generated/prisma/client';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';

/**
 * Organization Server Actions
 *
 * These actions handle organization management (create, update, switch).
 */

const createOrgSchema = z.object({
  name: z.string().min(3, 'Name muss mindestens 3 Zeichen lang sein'),
});

export type OrgActionResult =
  | { success: true; organizationId: string }
  | { success: false; error: string };

/**
 * Create a new organization
 *
 * Creates an organization and adds the current user as OWNER.
 */
export async function createOrganization(
  formData: FormData
): Promise<OrgActionResult | never> {
  try {
    const session = await requireAuth();
    const name = formData.get('name') as string;

    // Validate input
    const validation = createOrgSchema.safeParse({ name });
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
    });

    if (!user) {
      return {
        success: false,
        error: 'Benutzer nicht gefunden',
      };
    }

    // Create organization and membership in a transaction
    const org = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. Create organization
        const newOrg = await tx.organization.create({
          data: { name: validation.data.name },
        });

        // 2. Add user as OWNER
        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: newOrg.id,
            role: 'OWNER',
          },
        });

        return newOrg;
      }
    );

    // Set active org cookie and redirect to dashboard
    const cookieStore = await cookies();
    cookieStore.set('active-org-id', org.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    redirect('/dashboard');
  } catch (error) {
    // redirect() throws, so we need to catch and rethrow
    if ((error as Error).message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('Create organization error:', error);
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    };
  }
}

/**
 * Switch to a different organization
 *
 * Validates that the user is a member of the organization and sets a cookie.
 */
export async function switchOrganization(
  organizationId: string
): Promise<never> {
  const session = await requireAuth();

  // Verify that user is a member
  const user = await prisma.user.findUnique({
    where: { supabaseUserId: session.user.id },
    include: {
      memberships: {
        where: { organizationId },
      },
    },
  });

  if (!user?.memberships.length) {
    // User is not a member - redirect to dashboard without org
    redirect('/dashboard');
  }

  // Set active org cookie
  const cookieStore = await cookies();
  cookieStore.set('active-org-id', organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  redirect('/dashboard');
}

/**
 * Update organization details
 *
 * Only OWNER and ADMIN can update the organization.
 */
export async function updateOrganization(
  organizationId: string,
  formData: FormData
): Promise<OrgActionResult> {
  try {
    const session = await requireAuth();
    const name = formData.get('name') as string;

    // Validate input
    const validation = createOrgSchema.safeParse({ name });
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    // Get user and verify they are OWNER or ADMIN
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      include: {
        memberships: {
          where: {
            organizationId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!user?.memberships.length) {
      return {
        success: false,
        error: 'Keine Berechtigung zum Bearbeiten dieser Organisation',
      };
    }

    // Update organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: validation.data.name },
    });

    return {
      success: true,
      organizationId,
    };
  } catch (error) {
    console.error('Update organization error:', error);
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    };
  }
}

/**
 * Leave an organization
 *
 * Removes the current user's membership. OWNERs cannot leave if they are the only member.
 */
export async function leaveOrganization(
  organizationId: string
): Promise<OrgActionResult> {
  try {
    const session = await requireAuth();

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      include: {
        memberships: {
          where: { organizationId },
        },
      },
    });

    if (!user?.memberships.length) {
      return {
        success: false,
        error: 'Sie sind kein Mitglied dieser Organisation',
      };
    }

    const membership = user.memberships[0];

    // If user is OWNER, check if there is another owner
    if (membership.role === 'OWNER') {
      const otherOwnerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: 'OWNER',
          userId: { not: user.id },
        },
      });

      if (otherOwnerCount === 0) {
        return {
          success: false,
          error:
            'Als einziger Owner können Sie die Organisation nicht verlassen. Bitte ernennen Sie zuerst einen anderen Owner oder löschen Sie die Organisation.',
        };
      }
    }

    // Remove membership
    await prisma.organizationMember.delete({
      where: { id: membership.id },
    });

    return {
      success: true,
      organizationId,
    };
  } catch (error) {
    console.error('Leave organization error:', error);
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    };
  }
}
