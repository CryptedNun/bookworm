'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2,
  Type,
  Code,
  Quote,
  AlignLeft,
} from 'lucide-react';
import { updateBlock, insertBlock, deleteBlock } from '@/actions/blocks';
import type { User } from '@/actions/auth';
import type { Note } from '@/actions/notes';

interface Block {
  slot_id: string;
  lexorank_key: string;
  block_type: string;
  content_text: string;
  version_id: string;
  author_username: string;
  created_at: string;
}

type NoteWithBlocks = Note & {
  blocks: Block[];
  latest_commit_id: string;
  branch_id: string;
  notebook_title: string;
  owner_username: string;
  created_at: string;
};

interface NoteEditorProps {
  note: NoteWithBlocks;
  notebookId: string;
  user: User;
}

export default function NoteEditor({ note, notebookId, user }: NoteEditorProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(note.blocks);
  const [editingBlocks, setEditingBlocks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState<string | null>(null);

  const handleContentChange = (slotId: string, content: string) => {
    setEditingBlocks((prev) => ({ ...prev, [slotId]: content }));
  };

  const handleSaveBlock = async (slotId: string) => {
    const content = editingBlocks[slotId];
    if (content === undefined) return;

    setSaving(true);
    const result = await updateBlock({
      noteId: note.note_id,
      slotId,
      content,
      commitMessage: 'Update block content',
    });

    if (result.success) {
      // Update local state
      setBlocks((prev) =>
        prev.map((b) =>
          b.slot_id === slotId ? { ...b, content_text: content } : b
        )
      );
      setEditingBlocks((prev) => {
        const updated = { ...prev };
        delete updated[slotId];
        return updated;
      });
      router.refresh();
    } else {
      alert(result.error || 'Failed to save');
    }
    setSaving(false);
  };

  const handleInsertBlock = async (
    prevSlotId: string | null,
    blockType: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE'
  ) => {
    setSaving(true);
    
    const prevIndex = prevSlotId
      ? blocks.findIndex((b) => b.slot_id === prevSlotId)
      : -1;
    const nextSlotId = prevIndex < blocks.length - 1 ? blocks[prevIndex + 1]?.slot_id : null;

    const result = await insertBlock({
      noteId: note.note_id,
      prevSlotId,
      nextSlotId,
      blockType,
      content: getDefaultContent(blockType),
    });

    if (result.success) {
      router.refresh();
      setShowInsertMenu(null);
    } else {
      alert(result.error || 'Failed to insert block');
    }
    setSaving(false);
  };

  const handleDeleteBlock = async (slotId: string) => {
    if (!confirm('Delete this block?')) return;

    setSaving(true);
    const result = await deleteBlock({
      noteId: note.note_id,
      slotId,
    });

    if (result.success) {
      setBlocks((prev) => prev.filter((b) => b.slot_id !== slotId));
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete');
    }
    setSaving(false);
  };

  const getDefaultContent = (blockType: string): string => {
    switch (blockType) {
      case 'HEADING':
        return '# New Heading';
      case 'CODE':
        return '```\n// Your code here\n```';
      case 'QUOTE':
        return '> Quote';
      default:
        return 'New paragraph';
    }
  };

  const getBlockIcon = (blockType: string) => {
    switch (blockType) {
      case 'HEADING':
        return <Type className="w-4 h-4" />;
      case 'CODE':
        return <Code className="w-4 h-4" />;
      case 'QUOTE':
        return <Quote className="w-4 h-4" />;
      default:
        return <AlignLeft className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/notebooks/${notebookId}`}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div>
              <h1 className="text-lg font-bold text-zinc-100">{note.title}</h1>
              <p className="text-xs text-zinc-500">
                Editing • {blocks.length} blocks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/notebooks/${notebookId}`)}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-4">
          {/* Insert at start */}
          <div className="relative">
            <button
              onClick={() => setShowInsertMenu(showInsertMenu === 'start' ? null : 'start')}
              disabled={saving}
              className="w-full py-2 border-2 border-dashed border-zinc-800 hover:border-emerald-500 rounded-lg text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Insert block</span>
            </button>

            {showInsertMenu === 'start' && (
              <div className="absolute top-full left-0 mt-2 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 p-2 z-10">
                <button
                  onClick={() => handleInsertBlock(null, 'PARAGRAPH')}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                >
                  <AlignLeft className="w-4 h-4" /> Paragraph
                </button>
                <button
                  onClick={() => handleInsertBlock(null, 'HEADING')}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                >
                  <Type className="w-4 h-4" /> Heading
                </button>
                <button
                  onClick={() => handleInsertBlock(null, 'CODE')}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                >
                  <Code className="w-4 h-4" /> Code
                </button>
                <button
                  onClick={() => handleInsertBlock(null, 'QUOTE')}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                >
                  <Quote className="w-4 h-4" /> Quote
                </button>
              </div>
            )}
          </div>

          {/* Blocks */}
          {blocks.map((block, index) => {
            const isEditing = editingBlocks[block.slot_id] !== undefined;
            const displayContent = isEditing
              ? editingBlocks[block.slot_id]
              : block.content_text;

            return (
              <div key={block.slot_id} className="space-y-4">
                <div className="group relative bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-zinc-800 text-zinc-400">
                      {getBlockIcon(block.block_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-zinc-500">
                          {block.block_type}
                        </span>
                        <span className="text-xs text-zinc-600">•</span>
                        <span className="text-xs text-zinc-600">
                          {block.author_username}
                        </span>
                      </div>

                      <textarea
                        value={displayContent}
                        onChange={(e) =>
                          handleContentChange(block.slot_id, e.target.value)
                        }
                        onBlur={() => isEditing && handleSaveBlock(block.slot_id)}
                        disabled={saving}
                        className="w-full bg-transparent text-zinc-100 border-none outline-none resize-none font-mono text-sm leading-relaxed disabled:opacity-50"
                        rows={Math.max(3, displayContent.split('\n').length)}
                      />

                      {isEditing && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleSaveBlock(block.slot_id)}
                            disabled={saving}
                            className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingBlocks((prev) => {
                                const updated = { ...prev };
                                delete updated[block.slot_id];
                                return updated;
                              });
                            }}
                            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteBlock(block.slot_id)}
                      disabled={saving}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Insert after this block */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowInsertMenu(
                        showInsertMenu === block.slot_id ? null : block.slot_id
                      )
                    }
                    disabled={saving}
                    className="w-full py-2 border-2 border-dashed border-zinc-800 hover:border-emerald-500 rounded-lg text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Insert block</span>
                  </button>

                  {showInsertMenu === block.slot_id && (
                    <div className="absolute top-full left-0 mt-2 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 p-2 z-10">
                      <button
                        onClick={() => handleInsertBlock(block.slot_id, 'PARAGRAPH')}
                        className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                      >
                        <AlignLeft className="w-4 h-4" /> Paragraph
                      </button>
                      <button
                        onClick={() => handleInsertBlock(block.slot_id, 'HEADING')}
                        className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                      >
                        <Type className="w-4 h-4" /> Heading
                      </button>
                      <button
                        onClick={() => handleInsertBlock(block.slot_id, 'CODE')}
                        className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                      >
                        <Code className="w-4 h-4" /> Code
                      </button>
                      <button
                        onClick={() => handleInsertBlock(block.slot_id, 'QUOTE')}
                        className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2"
                      >
                        <Quote className="w-4 h-4" /> Quote
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {blocks.length === 0 && (
            <div className="text-center py-20 text-zinc-500">
              <p>No blocks yet. Click "Insert block" to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
