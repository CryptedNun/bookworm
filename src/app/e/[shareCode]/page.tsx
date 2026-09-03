import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicEdition } from '@/actions/editions';
import { getCurrentUser } from '@/actions/auth';
import { getNotebooks } from '@/actions/notebooks';
import PublicEditionClient from './edition-client';

export default async function PublicEditionPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  const result = await getPublicEdition(shareCode);

  if (!result.success || !result.edition) {
    notFound();
  }

  const edition = result.edition;
  const user = await getCurrentUser();

  // If user is logged in, fetch their notebooks for 1-click forking
  let userNotebooks: Array<{ notebook_id: string; title: string }> = [];
  if (user) {
    try {
      const res = await getNotebooks(user.user_id);
      userNotebooks = (res || []).map((nb: any) => ({
        notebook_id: nb.notebook_id,
        title: nb.title,
      }));
    } catch (e) {
      console.warn('Could not fetch user notebooks for forking:', e);
    }
  }

  return (
    <PublicEditionClient
      edition={edition}
      currentUser={user ? { user_id: user.user_id, username: user.username } : null}
      userNotebooks={userNotebooks}
    />
  );
}
