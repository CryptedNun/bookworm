import React from 'react';
import { BookOpen, Loader2 } from 'lucide-react';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-400">
      <div className="relative flex flex-col items-center gap-4 animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
            <BookOpen className="w-7 h-7 animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          </div>
        </div>

        <div className="space-y-1 text-center">
          <h2 className="text-sm font-bold text-zinc-200 tracking-tight">BookWorm</h2>
          <p className="text-xs text-zinc-500 font-mono">Loading workspace & version state...</p>
        </div>

        {/* Shimmer skeleton preview */}
        <div className="w-64 h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-2 border border-zinc-800">
          <div className="h-full bg-emerald-500/60 rounded-full w-1/2 animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>
      </div>
    </div>
  );
}
