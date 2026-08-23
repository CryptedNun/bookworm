"use client";

import React from "react";
import {
  BookOpen,
  GitBranch,
  CircleDot,
  GitPullRequest,
  Sparkles,
  Layers,
  FolderPlus,
  FilePlus,
  GitFork,
  Database,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { currentUser } from "@/lib/mock-data";

interface HomeFeedProps {
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
}

export function HomeFeed({ onOpenCreate }: HomeFeedProps) {
  return (
    <main className="flex-1 min-w-0 p-4 lg:p-8 space-y-8 overflow-y-auto">
      {/* 1. Welcome Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 lg:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GitHub for Notes • Localhost Preview</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-extrabold text-zinc-100 tracking-tight">
            Welcome back, {currentUser.name}
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Manage your modular notes with Git-like branches, LexoRank block ordering, granular permissions, and content-addressed deduplication.
          </p>

          {/* Quick Action Buttons Directing to Functionalities */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3">
            <button
              onClick={() => onOpenCreate("note")}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <FilePlus className="w-4 h-4" />
              New Note
            </button>

            <button
              onClick={() => onOpenCreate("notebook")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-purple-400" />
              New Notebook
            </button>

            <button
              onClick={() => onOpenCreate("issue")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CircleDot className="w-4 h-4 text-amber-400" />
              New Issue
            </button>

            <button
              onClick={() => onOpenCreate("branch")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="w-4 h-4 text-blue-400" />
              New Branch
            </button>

            <button
              onClick={() => onOpenCreate("fork")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitFork className="w-4 h-4 text-cyan-400" />
              Fork Note
            </button>
          </div>
        </div>
      </div>

      {/* 2. Core Architecture Stat Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Owned & Contributed</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">17 Notes</div>
          <p className="text-[11px] text-zinc-500">Across 4 notebooks</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Active Block Issues</span>
            <CircleDot className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">3 Open</div>
          <p className="text-[11px] text-zinc-500">Slot locks in effect</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Branch Merges</span>
            <GitPullRequest className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">14 Merged</div>
          <p className="text-[11px] text-zinc-500">Ternary manifests updated</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">CAS Deduplication</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">82.5%</div>
          <p className="text-[11px] text-zinc-500">Shared content blobs</p>
        </div>
      </div>

      {/* 3. Middle / Right Feed Placeholder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-200">Activity & Home Feed</h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Localhost Simulation</span>
        </div>

        {/* Minimalist Feed Placeholder State */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto shadow-inner">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-zinc-200">
              Home feed placeholder
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Global collaborative updates, note timeline commits, access invitations, and community forks will be rendered in this area as we continue building.
            </p>
          </div>

          {/* Demonstration list of recent collaborative events */}
          <div className="max-w-lg mx-auto text-left pt-4 divide-y divide-zinc-800/60 border-t border-zinc-800/60">
            <div className="py-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-zinc-200 font-medium">
                  <span className="text-emerald-400">@alice</span> published edition <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">v2.1 Final</code> of <span className="text-zinc-100 font-semibold">B-Trees and AVL Self-Balancing Trees</span>
                </p>
                <p className="text-[10px] text-zinc-500">10 minutes ago • Pinned to commit <span className="font-mono">#b7f92a</span></p>
              </div>
            </div>

            <div className="py-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <CircleDot className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-zinc-200 font-medium">
                  <span className="text-amber-400">@bob</span> opened Issue <span className="font-semibold">#14: Fix typo in AVL double rotation</span> targeting <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">Slot #42</code>
                </p>
                <p className="text-[10px] text-zinc-500">2 hours ago • Branch <span className="font-mono">issue-14-avl-rotation</span> created</p>
              </div>
            </div>

            <div className="py-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                <GitPullRequest className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-zinc-200 font-medium">
                  <span className="text-blue-400">@alice</span> merged branch <span className="font-mono text-zinc-300">issue-12-dijkstra-proof</span> into <span className="text-emerald-400 font-mono">main</span>
                </p>
                <p className="text-[10px] text-zinc-500">1 day ago • Manifest updated across 62 slots</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

