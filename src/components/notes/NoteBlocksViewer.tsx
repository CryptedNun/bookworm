'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  History,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Edit,
  FileText,
  CornerDownRight,
} from 'lucide-react';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';
import BlockHistoryModal from '@/components/notes/BlockHistoryModal';
import { rebalanceNoteBlocks } from '@/actions/blocks';

export interface NoteBlockItem {
  slot_id: string;
  block_type: string;
  lexorank_key: string;
  parent_slot_id?: string | null;
  version_id: string;
  content_text: string;
  sha256: string;
}

interface NoteBlocksViewerProps {
  noteId: string;
  notebookId: string;
  blocks: NoteBlockItem[];
  canEdit?: boolean;
}

export default function NoteBlocksViewer({
  noteId,
  notebookId,
  blocks,
  canEdit = false,
}: NoteBlocksViewerProps) {
  const [selectedSlotForHistory, setSelectedSlotForHistory] = useState<string | null>(null);
  const [copiedSlotId, setCopiedSlotId] = useState<string | null>(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceToast, setRebalanceToast] = useState<string | null>(null);

  const handleCopyBlock = (slotId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSlotId(slotId);
    setTimeout(() => setCopiedSlotId(null), 2000);
  };

  const handleRebalance = async () => {
    if (rebalancing) return;
    setRebalancing(true);
    try {
      const res = await rebalanceNoteBlocks(noteId);
      if (res.success) {
        setRebalanceToast(`Successfully rebalanced ${res.count} blocks to standard LexoRank spacing!`);
        setTimeout(() => setRebalanceToast(null), 4000);
      } else {
        alert(res.error || 'Failed to rebalance');
      }
    } catch (err: any) {
      alert(err.message || 'Error during rebalance');
    } finally {
      setRebalancing(false);
    }
  };

  if (blocks.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
        <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-400 mb-4">This note does not have any content blocks yet.</p>
        <Link
          href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors"
        >
          <Edit className="w-4 h-4" />
          Open Block Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Maintainer Tools Bar */}
      {canEdit && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs">
          <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
            <span>{blocks.length} Total Blocks</span>
            <span>•</span>
            <span className="text-emerald-400">LexoRank O(1) Indexed</span>
          </div>

          <button
            onClick={handleRebalance}
            disabled={rebalancing}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Re-space all fractional LexoRank keys back to standard intervals (FAQ Q7)"
          >
            <RotateCcw className={`w-3 h-3 text-purple-400 ${rebalancing ? 'animate-spin' : ''}`} />
            <span>{rebalancing ? 'Rebalancing...' : 'Rebalance LexoRank'}</span>
          </button>
        </div>
      )}

      {/* Toast */}
      {rebalanceToast && (
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{rebalanceToast}</span>
        </div>
      )}

      {/* Blocks List with Indentation Support */}
      <div className="space-y-4">
        {blocks.map((block) => {
          const isNested = !!block.parent_slot_id;

          return (
            <div
              key={block.slot_id}
              id={block.slot_id}
              className={`group relative rounded-xl border border-transparent hover:border-zinc-800 hover:bg-zinc-900/20 transition-all p-3 -mx-3 ${
                isNested ? 'ml-6 pl-4 border-l-2 border-emerald-500/30' : ''
              }`}
            >
              {isNested && (
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono mb-1">
                  <CornerDownRight className="w-3 h-3 text-emerald-400/60" />
                  <span>Child Block (Parent: {block.parent_slot_id?.substring(0, 8)}...)</span>
                </div>
              )}

              {/* Floating Action Bar on Hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                {/* 1. Copy text */}
                <button
                  onClick={() => handleCopyBlock(block.slot_id, block.content_text)}
                  className="p-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 shadow-md transition-all backdrop-blur-sm cursor-pointer"
                  title="Copy block text"
                >
                  {copiedSlotId === block.slot_id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                {/* 2. Block Revision History / Blame */}
                <button
                  onClick={() => setSelectedSlotForHistory(block.slot_id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-[11px] font-medium border border-zinc-700/50 shadow-md transition-all backdrop-blur-sm cursor-pointer"
                  title="View complete version history and revisions for this block"
                >
                  <History className="w-3 h-3 text-blue-400" />
                  <span>History</span>
                </button>

                {/* 3. Propose Edit / Lock Block */}
                <Link
                  href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/issues?slotId=${block.slot_id}&action=new`}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-amber-300 text-[11px] font-medium border border-amber-500/30 shadow-md transition-all backdrop-blur-sm"
                  title="Lock this block and propose an edit via an issue"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Propose Edit</span>
                </Link>
              </div>

              {/* Markdown Content */}
              <div className="prose prose-invert prose-emerald max-w-none">
                <RobustMarkdown content={block.content_text || ''} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Block History & Time Machine Modal */}
      {selectedSlotForHistory && (
        <BlockHistoryModal
          isOpen={true}
          noteId={noteId}
          slotId={selectedSlotForHistory}
          canEdit={canEdit}
          onClose={() => setSelectedSlotForHistory(null)}
          onRestored={() => window.location.reload()}
        />
      )}
    </div>
  );
}
