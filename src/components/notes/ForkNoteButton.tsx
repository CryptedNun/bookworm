'use client';

import React, { useState } from 'react';
import { GitFork } from 'lucide-react';
import ForkNoteModal from './ForkNoteModal';

interface ForkNoteButtonProps {
  noteId: string;
  noteTitle: string;
  userId: string;
  userNotebooks: Array<{ notebook_id: string; title: string; role_type?: string }>;
  className?: string;
}

export default function ForkNoteButton({
  noteId,
  noteTitle,
  userId,
  userNotebooks,
  className,
}: ForkNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          className ||
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-cyan-400 text-xs font-medium border border-zinc-700/60 transition-colors'
        }
        title="Create a zero-cost fork of this note in another notebook"
      >
        <GitFork className="w-3.5 h-3.5 text-cyan-400" />
        <span>Fork</span>
      </button>

      <ForkNoteModal
        noteId={noteId}
        noteTitle={noteTitle}
        userId={userId}
        userNotebooks={userNotebooks}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
