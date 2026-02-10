import { OrgSwitcher } from '@/src/components/org-switcher';
import { Toaster } from '@/src/components/ui/sonner';
import { requireAuth } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/client';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Image from 'next/image';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: AppLayoutProps) {
  const session = await requireAuth();
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get('active-org-id')?.value;

  // Get user with all memberships
  const user = await prisma.user.findUnique({
    where: { supabaseUserId: session.user.id },
    include: {
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  // If user has no organizations, redirect to onboarding
  if (!user.memberships.length) {
    redirect('/onboarding');
  }

  // Determine active organization from cookie
  let activeOrgId = orgCookie || user.memberships[0].organizationId;

  // Verify user has access to the requested org
  const activeMembership = user.memberships.find(
    (m: (typeof user.memberships)[number]) => m.organizationId === activeOrgId
  );

  if (!activeMembership) {
    // User doesn't have access to this org, use first available org
    activeOrgId = user.memberships[0].organizationId;
  }

  const organizations = user.memberships.map((m: (typeof user.memberships)[number]) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
  }));

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <Image
                src="/assets/logo-icon.png"
                alt="E-Rechnung Logo"
                width={32}
                height={32}
                className="rounded"
              />
              <h1 className="text-xl font-bold text-gray-900">E-Rechnung</h1>
            </div>
            <div className="flex items-center space-x-4">
              <OrgSwitcher
                organizations={organizations}
                activeOrgId={activeOrgId}
              />
              <div className="text-sm text-gray-700">{user.email}</div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
      <Toaster />
    </div>
  );
}
