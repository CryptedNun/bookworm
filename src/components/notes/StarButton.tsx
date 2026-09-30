'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { toggleStarResource } from '@/actions/stars';

interface StarButtonProps {
  resourceId: string;
  initialStarred?: boolean;
  initialCount?: number;
  className?: string;
  showLabel?: boolean;
  showCount?: boolean;
}

export default function StarButton({
  resourceId,
  initialStarred = false,
  initialCount = 0,
  className = '',
  showLabel = true,
  showCount = true,
}: StarButtonProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    const prevStarred = starred;
    const prevCount = count;
    // Optimistic toggle
    const nextStarred = !prevStarred;
    setStarred(nextStarred);
    setCount(Math.max(0, prevCount + (nextStarred ? 1 : -1)));

    try {
      const res = await toggleStarResource(resourceId);
      if (res.success && res.isStarred !== undefined) {
        setStarred(res.isStarred);
      } else {
        // Revert on failure
        setStarred(prevStarred);
        setCount(prevCount);
      }
    } catch (err) {
      setStarred(prevStarred);
      setCount(prevCount);
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
      title={starred ? 'Unstar this resource' : 'Star this resource'}
    >
      <Star
        className={`w-3.5 h-3.5 ${
          starred ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'
        }`}
      />
      {showLabel && <span>{starred ? 'Starred' : 'Star'}</span>}
      {showCount && count > 0 && (
        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-zinc-800/80 text-zinc-300 font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}
