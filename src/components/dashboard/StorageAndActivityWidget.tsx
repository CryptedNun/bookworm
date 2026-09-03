'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Database, 
  Layers, 
  GitCommit, 
  BookMarked, 
  GitMerge, 
  CircleDot, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import type { StorageAnalytics, ActivityItem } from '@/actions/dashboard';

interface StorageAndActivityWidgetProps {
  analytics: StorageAnalytics;
  activities: ActivityItem[];
}

export default function StorageAndActivityWidget({
  analytics,
  activities = [],
}: StorageAndActivityWidgetProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Content-Addressed Storage (CAS) Analytics Card */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                Storage & CAS Engine
              </h3>
              <p className="text-[10px] text-zinc-400">Content-Addressed Deduplication</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            SHA-256 Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Unique Blobs</div>
            <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
              {analytics.uniqueBlobs}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{(analytics.storedBytes / 1024).toFixed(1)} KB stored</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Block Versions</div>
            <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
              {analytics.totalVersions}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">3-layer manifests</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Published Editions</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {analytics.totalEditions}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Pinned releases</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Merged Branches</div>
            <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">
              {analytics.mergedBranches}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Zero merge conflicts</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Zero-Cost Forking Guarantee</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Every block is hashed by SHA-256. Forking notes references existing immutable blobs without copying content text or consuming additional disk space.
          </p>
        </div>
      </div>

      {/* 2. Unified Activity Feed (Spans 2 columns on lg screens) */}
      <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                Recent Repository Activity
              </h3>
              <p className="text-[10px] text-zinc-400">Live feed across all collaborative workspaces</p>
            </div>
          </div>
          <span className="text-[11px] text-zinc-400">
            {activities.length} recent events
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs">
            No activity recorded yet. Create a note, issue, or edition to start the timeline!
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/50">
            {activities.map((act) => {
              const formattedTime = new Date(act.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={act.id} className="p-3 flex items-start justify-between gap-3 hover:bg-zinc-850/40 transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {act.activity_type === 'EDITION' && (
                        <div className="p-1 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                          <BookMarked className="w-3 h-3" />
                        </div>
                      )}
                      {act.activity_type === 'COMMIT' && (
                        <div className="p-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          <GitCommit className="w-3 h-3" />
                        </div>
                      )}
                      {act.activity_type === 'ISSUE' && (
                        <div className="p-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <CircleDot className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-zinc-200 text-xs truncate">
                          {act.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span className="font-mono text-emerald-400">@{act.actor}</span>
                        <span>•</span>
                        <span className="truncate max-w-[200px] text-zinc-400">{act.context}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-400 font-mono shrink-0">
                    {formattedTime}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
