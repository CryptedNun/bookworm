'use client';

import React, { useState } from 'react';
import { BookMarked, Globe, ChevronDown, ExternalLink, Plus, Check } from 'lucide-react';
import PublishEditionModal from './PublishEditionModal';
import type { EditionItem } from '@/actions/editions';

interface PublishEditionButtonProps {
  noteId: string;
  noteTitle: string;
  editions?: EditionItem[];
  canPublish?: boolean;
}

export default function PublishEditionButton({
  noteId,
  noteTitle,
  editions = [],
  canPublish = true,
}: PublishEditionButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const hasEditions = editions.length > 0;

  return (
    <>
      <div className="relative">
        <div className="flex items-center">
          <button
            onClick={() => {
              if (hasEditions) {
                setShowDropdown(!showDropdown);
              } else if (canPublish) {
                setIsModalOpen(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-purple-400 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer"
            title="View or publish public note editions"
          >
            <BookMarked className="w-3.5 h-3.5 text-purple-400" />
            <span>Editions</span>
            {hasEditions && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-mono border border-purple-500/20">
                {editions.length}
              </span>
            )}
            {hasEditions && <ChevronDown className="w-3 h-3 text-zinc-500" />}
          </button>
        </div>

        {/* Editions Dropdown */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-2 z-50 text-xs text-zinc-200 divide-y divide-zinc-800/80 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Published Snapshots
                </span>
                {canPublish && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setIsModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/40">
                {editions.map((ed) => (
                  <a
                    key={ed.edition_id}
                    href={`/e/${ed.share_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 flex items-start justify-between gap-2 hover:bg-zinc-800/60 transition-colors group block"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-100 truncate">{ed.edition_name}</span>
                        {ed.is_standard && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            standard
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">/e/{ed.share_code}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>

              {canPublish && (
                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setIsModalOpen(true);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Publish New Snapshot
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PublishEditionModal
        noteId={noteId}
        noteTitle={noteTitle}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
