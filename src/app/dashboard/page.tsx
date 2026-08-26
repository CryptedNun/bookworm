/**
 * Dashboard Page (Server Component)
 * 
 * Fetches user data and notebooks from database before rendering client dashboard
 */

import { getCurrentUserWithStats } from '@/actions/auth';
import { getUserNotebooks } from '@/actions/notebooks';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';

export default async function DashboardPage() {
  // Fetch current user with stats (Server Component - direct DB query)
  const user = await getCurrentUserWithStats();

  // Middleware should prevent this, but double-check
  if (!user) {
    redirect('/');
  }

  // Fetch user's notebooks
  const notebooksResult = await getUserNotebooks();
  const notebooks = notebooksResult.success ? notebooksResult.notebooks || [] : [];

  // Pass real user data and notebooks to client component
  return <DashboardClient user={user} notebooks={notebooks} />;
}
