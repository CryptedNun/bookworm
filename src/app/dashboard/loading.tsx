import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      {/* TopNav Skeleton */}
      <div className="h-12 border-b border-zinc-800/80 bg-zinc-950/80 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-28 h-6 bg-zinc-800/60 rounded-lg animate-pulse" />
          <div className="w-20 h-5 bg-zinc-850 rounded-md animate-pulse hidden sm:block" />
        </div>
        <div className="w-80 h-7 bg-zinc-900 rounded-lg border border-zinc-800 animate-pulse hidden md:block" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-zinc-850 rounded-lg animate-pulse" />
          <div className="w-7 h-7 bg-zinc-850 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Body Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Skeleton */}
        <div className="w-64 border-r border-zinc-800/60 bg-zinc-950/50 p-4 space-y-4 hidden md:flex flex-col">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800/80 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="w-20 h-3.5 bg-zinc-800 rounded animate-pulse" />
              <div className="w-14 h-2.5 bg-zinc-850 rounded animate-pulse" />
            </div>
          </div>
          <div className="w-full h-8 bg-zinc-900 rounded-lg border border-zinc-800/80 animate-pulse" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-zinc-900/60 rounded-xl border border-zinc-800/40 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Main Feed Skeleton */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Welcome Banner Skeleton */}
          <div className="h-28 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 space-y-3 animate-pulse">
            <div className="w-48 h-5 bg-zinc-800 rounded" />
            <div className="w-96 h-3 bg-zinc-850 rounded" />
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-zinc-900/30 border border-zinc-800/60 p-5 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="w-24 h-3 bg-zinc-800 rounded" />
                  <div className="w-12 h-3 bg-zinc-850 rounded" />
                </div>
                <div className="w-36 h-5 bg-zinc-800 rounded" />
                <div className="w-full h-12 bg-zinc-950/40 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
