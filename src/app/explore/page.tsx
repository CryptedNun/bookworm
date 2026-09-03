import React from 'react';
import { getPublicExploreData } from '@/actions/explore';
import { getCurrentUser } from '@/actions/auth';
import { getNotebooks } from '@/actions/notebooks';
import ExploreClient from './explore-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Explore Community Notes • BookWorm',
  description: 'Discover open study materials, published editions, and fork notes with Content-Addressed Storage.',
};

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const exploreData = await getPublicExploreData();

  let userNotebooks: Array<{ notebook_id: string; title: string }> = [];
  if (user) {
    try {
      const res = await getNotebooks(user.user_id);
      userNotebooks = (res || []).map((nb) => ({
        notebook_id: nb.notebook_id,
        title: nb.title,
      }));
    } catch (e) {
      console.warn('Could not fetch user notebooks for forking:', e);
    }
  }

  return (
    <ExploreClient
      notebooks={exploreData.notebooks}
      notes={exploreData.notes}
      editions={exploreData.editions}
      currentUser={user ? { user_id: user.user_id, username: user.username } : null}
      userNotebooks={userNotebooks}
    />
  );
}
