'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error caught by boundary:', error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6" />
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-bold text-zinc-100">Unable to load dashboard data</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {error.message || 'A network error or database timeout occurred while fetching your workspace.'}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => reset()}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reload</span>
        </button>

        <button
          onClick={() => window.location.href = '/dashboard'}
          className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
