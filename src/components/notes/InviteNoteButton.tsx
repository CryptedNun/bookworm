'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import NoteInviteModal from './NoteInviteModal';

interface InviteNoteButtonProps {
  noteId: string;
  noteTitle: string;
  currentUserId: string;
  currentUserRole: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
}

export default function InviteNoteButton({
  noteId,
  noteTitle,
  currentUserId,
  currentUserRole,
}: InviteNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const canInvite = ['OWNER', 'MAINTAINER'].includes(currentUserRole);

  if (!canInvite) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer"
        title="Invite collaborators to this note"
      >
        <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
        <span>Invite</span>
      </button>

      <NoteInviteModal
        noteId={noteId}
        noteTitle={noteTitle}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
