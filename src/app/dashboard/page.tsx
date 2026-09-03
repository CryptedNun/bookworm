/**
 * Dashboard Page (Server Component)
 * 
 * Fetches user data and notebooks from database before rendering client dashboard
 */

import { getCurrentUserWithStats } from '@/actions/auth';
import { getUserNotebooks } from '@/actions/notebooks';
import { getDashboardOverview } from '@/actions/dashboard';
import { getUserStarredResources } from '@/actions/stars';
import { getPendingInvitations } from '@/actions/permissions';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Fetch current user with stats (Server Component - direct DB query)
  const user = await getCurrentUserWithStats();

  // Middleware should prevent this, but if user no longer exists in DB, purge session
  if (!user) {
    redirect('/?session=expired');
  }

  // Fetch user's notebooks
  const notebooksResult = await getUserNotebooks();
  const notebooks = notebooksResult.success ? notebooksResult.notebooks || [] : [];

  // Fetch dashboard overview (unmerged branches, notes in notebooks, roles, analytics, activities)
  const overviewResult = await getDashboardOverview();
  const unmergedBranches = overviewResult.unmergedBranches || [];
  const dashboardNotes = overviewResult.notes || [];
  const userRoles = overviewResult.roles || [];
  const analytics = overviewResult.analytics;
  const activities = overviewResult.activities || [];

  // Fetch user's starred resources
  const starredResult = await getUserStarredResources(user.user_id);
  const starredItems = starredResult.success && starredResult.items ? starredResult.items : [];

  // Fetch pending invitations received by this user
  const invitationsResult = await getPendingInvitations(user.user_id);
  const pendingInvitations = invitationsResult.success && invitationsResult.invitations ? invitationsResult.invitations : [];

  // Pass real user data, notebooks, and overview to client component
  return (
    <DashboardClient 
      user={user} 
      notebooks={notebooks} 
      unmergedBranches={unmergedBranches}
      dashboardNotes={dashboardNotes}
      userRoles={userRoles}
      analytics={analytics}
      activities={activities}
      starredItems={starredItems}
      pendingInvitations={pendingInvitations as any}
    />
  );
}
