'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { toggleStarResource } from '@/actions/stars';

interface StarButtonProps {
  resourceId: string;
  initialStarred?: boolean;
  className?: string;
  showLabel?: boolean;
}

export default function StarButton({
  resourceId,
  initialStarred = false,
  className = '',
  showLabel = true,
}: StarButtonProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    // Optimistic toggle
    setStarred(!starred);

    try {
      const res = await toggleStarResource(resourceId);
      if (res.success && res.isStarred !== undefined) {
        setStarred(res.isStarred);
      } else {
        // Revert on failure
        setStarred(starred);
      }
    } catch (err) {
      setStarred(starred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
        starred
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
          : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
      } ${className}`}
      title={starred ? 'Unstar this note' : 'Star this note'}
    >
      <Star
        className={`w-3.5 h-3.5 ${
          starred ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'
        }`}
      />
      {showLabel && <span>{starred ? 'Starred' : 'Star'}</span>}
    </button>
  );
}
