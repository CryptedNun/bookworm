'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  GitBranch, 
  GitMerge, 
  GitFork, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle,
  Sparkles,
  Lock,
  Database,
  ArrowRight,
  Layers,
  Code
} from 'lucide-react';

export default function VersionControlGuide() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'locking' | 'branching' | 'merging' | 'forking'>('locking');

  const concepts = [
    {
      id: 'locking' as const,
      icon: Lock,
      title: '1. Block-Level Issues',
      subtitle: 'Zero-Conflict Locking',
      color: 'amber',
      pill: 'Conflict Prevention',
      headline: 'Issues target individual block slots, not entire files.',
      explanation:
        'In traditional Git, concurrent edits to a file cause painful merge conflicts. In BookWorm, notes are decomposed into independent block slots. Opening an issue locks that single slot, allowing contributors to propose edits while the rest of the note remains open for editing by others.',
      actionHint: 'To try it: Open any note, hover on a block, and click "Propose Edit" to lock that slot and start drafting.',
    },
    {
      id: 'branching' as const,
      icon: GitBranch,
      title: '2. Attempt Branches',
      subtitle: 'Isolated Experimentation',
      color: 'blue',
      pill: 'Safe Drafting',
      headline: 'Branches isolate contributor changes from the canonical main branch.',
      explanation:
        'When an issue is created, BookWorm automatically initializes a dedicated attempt branch (e.g., issue-dijkstra/charlie-fibonacci-heap). Multiple contributors can even work on competing attempt branches for the same issue, committing and refining block changes independently.',
      actionHint: 'To try it: In the block editor, use the branch dropdown in the header to switch between main and active attempt branches.',
    },
    {
      id: 'merging' as const,
      icon: GitMerge,
      title: '3. Review & Merge',
      subtitle: 'Winner Selection',
      color: 'purple',
      pill: 'Zero-Conflict Merge',
      headline: 'Maintainers inspect diffs and designate the winning branch to merge into main.',
      explanation:
        'Notebook owners and maintainers review proposed solutions side-by-side using branch comparison diffs. Merging automatically creates a merge commit on main, carries forward the block’s latest version in the commit manifest, closes the issue, and unlocks the slot for future collaboration.',
      actionHint: 'To try it: Navigate to any note’s Branches tab, click "Compare" to inspect line diffs, and click "Merge" to apply the changes.',
    },
    {
      id: 'forking' as const,
      icon: GitFork,
      title: '4. Zero-Cost Forking',
      subtitle: 'Content-Addressed Storage',
      color: 'cyan',
      pill: '0 Storage Overhead',
      headline: 'Fork any note instantly into your notebook with zero duplicate bytes.',
      explanation:
        'BookWorm stores all note contents in Content-Addressed Storage (CAS) keyed by SHA-256 hashes. When you fork a note, BookWorm clones the structure and references the identical content blobs without duplicating storage. Duplication only occurs when you alter a block.',
      actionHint: 'To try it: Click "Fork Note" on any note or edition to copy it into your own notebook workspace.',
    },
  ];

  const currentConcept = concepts.find((c) => c.id === activeTab)!;
  const CurrentIcon = currentConcept.icon;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-lg transition-all">
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-850/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-100">
                BookWorm Version Control Guide
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Workflow Cheatsheet
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              How Git-like block locking, attempt branching, merging, and zero-cost forking work
            </p>
          </div>
        </div>

        <button className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Interactive Body */}
      {isExpanded && (
        <div className="p-6 border-t border-zinc-800/80 space-y-6">
          {/* Step Selector Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {concepts.map((concept) => {
              const Icon = concept.icon;
              const isActive = activeTab === concept.id;
              return (
                <button
                  key={concept.id}
                  onClick={() => setActiveTab(concept.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isActive
                      ? 'border-emerald-500/60 bg-emerald-500/10 shadow-md shadow-emerald-950/20'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {concept.pill}
                    </span>
                  </div>

                  <div>
                    <h4
                      className={`text-xs font-bold ${
                        isActive ? 'text-zinc-100' : 'text-zinc-300'
                      }`}
                    >
                      {concept.title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      {concept.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Detailed Card */}
          <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-3">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-400">
              <CurrentIcon className="w-4 h-4" />
              <span>{currentConcept.headline}</span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {currentConcept.explanation}
            </p>

            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium text-[11px]">
                💡 <strong>Try it in BookWorm:</strong> {currentConcept.actionHint}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
