'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  GripVertical,
  Loader2,
  AlertCircle,
  CheckCircle,
  Scissors,
  Hash,
  FileCode,
  MessageSquareQuote,
  GitBranch,
  ChevronDown,
  ArrowRight,
  ChevronRight,
  Lock,
  Target,
  Home,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateBlock, insertBlock, deleteBlock, reorderBlock, splitBlock } from '@/actions/blocks';
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
  branches?: Array<{
    branch_id: string;
    branch_name: string;
    is_main: boolean;
    is_merged: boolean;
    target_slot_id?: string | null;
    issue_title?: string | null;
  }>;
  currentBranch?: {
    branch_id: string;
    branch_name: string;
    is_main: boolean;
    target_slot_id?: string | null;
    issue_title?: string | null;
  };
  userRole?: string;
}

interface SelectionMenuPosition {
  x: number;
  y: number;
}

// Text Selection Context Menu Component
function SelectionMenu({
  position,
  onSplitAs,
  onClose,
}: {
  position: SelectionMenuPosition;
  onSplitAs: (blockType: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE') => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-zinc-800 rounded-lg shadow-2xl border border-zinc-700 py-1 min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-700">
        Split selection as:
      </div>
      <button
        onClick={() => onSplitAs('PARAGRAPH')}
        className="w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors flex items-center gap-2 text-zinc-200"
      >
        <AlignLeft className="w-4 h-4" />
        <span>Paragraph</span>
        <kbd className="ml-auto text-xs text-zinc-500 font-mono">Ctrl+Shift+P</kbd>
      </button>
      <button
        onClick={() => onSplitAs('HEADING')}
        className="w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors flex items-center gap-2 text-zinc-200"
      >
        <Hash className="w-4 h-4" />
        <span>Heading</span>
        <kbd className="ml-auto text-xs text-zinc-500 font-mono">Ctrl+Shift+H</kbd>
      </button>
      <button
        onClick={() => onSplitAs('CODE')}
        className="w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors flex items-center gap-2 text-zinc-200"
      >
        <FileCode className="w-4 h-4" />
        <span>Code</span>
        <kbd className="ml-auto text-xs text-zinc-500 font-mono">Ctrl+Shift+C</kbd>
      </button>
      <button
        onClick={() => onSplitAs('QUOTE')}
        className="w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors flex items-center gap-2 text-zinc-200"
      >
        <MessageSquareQuote className="w-4 h-4" />
        <span>Quote</span>
        <kbd className="ml-auto text-xs text-zinc-500 font-mono">Ctrl+Shift+Q</kbd>
      </button>
      <div className="border-t border-zinc-700 mt-1 pt-1">
        <div className="px-4 py-2 text-xs text-zinc-500">
          <Scissors className="w-3 h-3 inline mr-1" />
          Tip: Select text and press Ctrl+/
        </div>
      </div>
    </div>
  );
}

// Sortable Block Component
function SortableBlock({ 
  block, 
  isEditing, 
  editContent, 
  onContentChange, 
  onSave, 
  onCancel,
  onDelete, 
  saving,
  getBlockIcon,
  showSuccess,
  onTextSelect,
  textareaRef,
  isLocked = false,
  isTarget = false,
  targetReason,
}: {
  block: Block;
  isEditing: boolean;
  editContent: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  saving: boolean;
  getBlockIcon: (blockType: string) => React.ReactNode;
  showSuccess: boolean;
  onTextSelect: (slotId: string, selection: { start: number; end: number; text: string }) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isLocked?: boolean;
  isTarget?: boolean;
  targetReason?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.slot_id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSelect = () => {
    if (isLocked || !textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = editContent.substring(start, end);

    if (start !== end && selectedText.trim().length > 0) {
      onTextSelect(block.slot_id, { start, end, text: selectedText });
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`group relative rounded-lg border transition-all ${
        isDragging 
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' 
          : isTarget
          ? 'border-amber-500/80 bg-amber-950/20 shadow-lg shadow-amber-500/10'
          : isLocked
          ? 'border-zinc-800/40 bg-zinc-950/40 opacity-70'
          : showSuccess
          ? 'border-emerald-500/50 bg-zinc-900'
          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
      }`}>
        <div className="flex items-start gap-3 p-4">
          {/* Drag Handle (Hidden if locked) */}
          {!isLocked ? (
            <button
              {...attributes}
              {...listeners}
              className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all cursor-grab active:cursor-grabbing touch-none"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          ) : (
            <div className="p-2 text-zinc-600 shrink-0" title="Reordering locked on this branch">
              <Lock className="w-4 h-4 text-zinc-600" />
            </div>
          )}

          {/* Block Type Icon */}
          <div className={`p-2 rounded flex-shrink-0 ${isTarget ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
            {getBlockIcon(block.block_type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-zinc-500">
                {block.block_type}
              </span>
              <span className="text-xs text-zinc-600">•</span>
              <span className="text-xs text-zinc-600">
                {block.author_username}
              </span>

              {isTarget && (
                <>
                  <span className="text-xs text-zinc-600">•</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1 border border-amber-500/30">
                    <Target className="w-3 h-3 text-amber-400" />
                    Target Block for Issue Revision
                  </span>
                </>
              )}

              {isLocked && (
                <>
                  <span className="text-xs text-zinc-600">•</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-zinc-500" />
                    Read-Only (Scoped to targeted block)
                  </span>
                </>
              )}

              {showSuccess && (
                <>
                  <span className="text-xs text-zinc-600">•</span>
                  <span className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Saved
                  </span>
                </>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => onContentChange(e.target.value)}
              onSelect={handleSelect}
              onBlur={() => !isLocked && isEditing && onSave()}
              onKeyDown={(e) => {
                if (isLocked) return;
                // Ctrl/Cmd + S to save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  onSave();
                }
                // Esc to cancel
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancel();
                }
              }}
              disabled={saving || isLocked}
              readOnly={isLocked}
              placeholder={isLocked ? "This block is read-only on this branch" : "Start typing... (Select text and press Ctrl+/ to split)"}
              className={`w-full bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed ${
                isLocked ? 'text-zinc-400 cursor-default' : 'text-zinc-100 placeholder:text-zinc-600'
              } disabled:opacity-75`}
              rows={Math.max(3, editContent.split('\n').length)}
            />

            {!isLocked && isEditing && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {isTarget ? 'Save Revision' : 'Save'}
                </button>
                <button
                  onClick={onCancel}
                  disabled={saving}
                  className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <span className="text-xs text-zinc-500 ml-auto">
                  Ctrl+S to save • Esc to cancel • Ctrl+/ to split selection
                </span>
              </div>
            )}
          </div>

          {/* Delete Button (hidden if locked) */}
          {!isLocked && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-all disabled:opacity-50"
              aria-label="Delete block"
              title="Delete block"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NoteEditor({ note, notebookId, user, branches = [], currentBranch, userRole = 'CONTRIBUTOR' }: NoteEditorProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(note.blocks);
  const isAttemptBranch = !!(currentBranch && !currentBranch.is_main);
  const targetSlotId = currentBranch?.target_slot_id;
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [editingBlocks, setEditingBlocks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBlocks, setSuccessBlocks] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Text selection state
  const [selectionMenu, setSelectionMenu] = useState<{
    slotId: string;
    selection: { start: number; end: number; text: string };
    position: SelectionMenuPosition;
  } | null>(null);
  
  const textareaRefs = useRef<Record<string, React.RefObject<HTMLTextAreaElement | null>>>({});

  // Initialize textarea refs
  useEffect(() => {
    blocks.forEach((block) => {
      if (!textareaRefs.current[block.slot_id]) {
        textareaRefs.current[block.slot_id] = React.createRef<HTMLTextAreaElement>();
      }
    });
  }, [blocks]);

  // Synchronize blocks and clear drafts when note or currentBranch changes
  useEffect(() => {
    setBlocks(note.blocks || []);
    setEditingBlocks({});
  }, [note.blocks, currentBranch?.branch_id]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Close branch menu on click outside
  useEffect(() => {
    if (!showBranchMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.branch-switcher')) {
        setShowBranchMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBranchMenu]);

  // Global keyboard shortcuts for text splitting
  useEffect(() => {
    const handleGlobalKeyboard = (e: KeyboardEvent) => {
      if (!selectionMenu) return;

      const { ctrlKey, metaKey, shiftKey, key } = e;
      const isMod = ctrlKey || metaKey;

      // Ctrl+Shift+P for Paragraph
      if (isMod && shiftKey && key === 'P') {
        e.preventDefault();
        handleSplitBlock('PARAGRAPH');
      }
      // Ctrl+Shift+H for Heading
      else if (isMod && shiftKey && key === 'H') {
        e.preventDefault();
        handleSplitBlock('HEADING');
      }
      // Ctrl+Shift+C for Code
      else if (isMod && shiftKey && key === 'C') {
        e.preventDefault();
        handleSplitBlock('CODE');
      }
      // Ctrl+Shift+Q for Quote
      else if (isMod && shiftKey && key === 'Q') {
        e.preventDefault();
        handleSplitBlock('QUOTE');
      }
      // Escape to close menu
      else if (key === 'Escape') {
        setSelectionMenu(null);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyboard);
    return () => document.removeEventListener('keydown', handleGlobalKeyboard);
  }, [selectionMenu]);

  // Handle text selection with Ctrl+/
  useEffect(() => {
    const handleSelectionShortcut = (e: KeyboardEvent) => {
      const { ctrlKey, metaKey, key } = e;
      const isMod = ctrlKey || metaKey;

      // Ctrl+/ to show split menu
      if (isMod && key === '/') {
        e.preventDefault();
        
        // Find which textarea is focused
        const activeElement = document.activeElement as HTMLTextAreaElement;
        if (activeElement && activeElement.tagName === 'TEXTAREA') {
          const slotId = Object.keys(textareaRefs.current).find(
            id => textareaRefs.current[id].current === activeElement
          );

          if (slotId) {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            const text = activeElement.value.substring(start, end);

            if (start !== end && text.trim().length > 0) {
              // Calculate menu position near cursor
              const rect = activeElement.getBoundingClientRect();
              const position = {
                x: rect.left + (rect.width / 2),
                y: rect.top - 10,
              };

              setSelectionMenu({
                slotId,
                selection: { start, end, text },
                position,
              });
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleSelectionShortcut);
    return () => document.removeEventListener('keydown', handleSelectionShortcut);
  }, []);

  const handleTextSelect = useCallback((
    slotId: string,
    selection: { start: number; end: number; text: string }
  ) => {
    // Don't show menu for very small selections
    if (selection.text.trim().length < 2) return;

    // Calculate position near the selection
    const textarea = textareaRefs.current[slotId]?.current;
    if (!textarea) return;

    const rect = textarea.getBoundingClientRect();
    const position = {
      x: rect.left + (rect.width / 2),
      y: rect.top - 10,
    };

    setSelectionMenu({ slotId, selection, position });
  }, []);

  const handleSplitBlock = useCallback(async (blockType: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE') => {
    if (isAttemptBranch || !selectionMenu) return;

    const { slotId, selection } = selectionMenu;
    const block = blocks.find(b => b.slot_id === slotId);
    if (!block) return;

    setSaving(true);
    setError(null);
    setSelectionMenu(null);

    try {
      const result = await splitBlock({
        noteId: note.note_id,
        originalSlotId: slotId,
        originalContent: editingBlocks[slotId] ?? block.content_text,
        selectedText: selection.text,
        selectionStart: selection.start,
        selectionEnd: selection.end,
        newBlockType: blockType,
      });

      if (result.success) {
        // Clear editing state for this block
        setEditingBlocks(prev => {
          const updated = { ...prev };
          delete updated[slotId];
          return updated;
        });

        // Show success
        setSuccessBlocks(prev => new Set(prev).add(slotId));
        setTimeout(() => {
          setSuccessBlocks(prev => {
            const updated = new Set(prev);
            updated.delete(slotId);
            return updated;
          });
        }, 2000);

        // Refresh to get new blocks
        router.refresh();
      } else {
        setError(result.error || 'Failed to split block');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to split block');
    } finally {
      setSaving(false);
    }
  }, [selectionMenu, blocks, editingBlocks, note.note_id, router, currentBranch]);

  const handleContentChange = useCallback((slotId: string, content: string) => {
    setEditingBlocks((prev) => ({ ...prev, [slotId]: content }));
    setError(null);
  }, []);

  const handleSaveBlock = useCallback(async (slotId: string) => {
    const content = editingBlocks[slotId];
    if (content === undefined) return;

    setSaving(true);
    setError(null);

    try {
      const result = await updateBlock({
        noteId: note.note_id,
        slotId,
        content,
        commitMessage: currentBranch?.is_main
          ? 'Update block content'
          : `Revise target block on ${currentBranch?.branch_name || 'branch'}`,
        branchId: currentBranch?.branch_id,
      });

      if (result.success) {
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

        setSuccessBlocks((prev) => new Set(prev).add(slotId));
        setTimeout(() => {
          setSuccessBlocks((prev) => {
            const updated = new Set(prev);
            updated.delete(slotId);
            return updated;
          });
        }, 2000);

        router.refresh();
      } else {
        setError(result.error || 'Failed to save block');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save block');
    } finally {
      setSaving(false);
    }
  }, [editingBlocks, note.note_id, router, currentBranch]);

  const handleCancelEdit = useCallback((slotId: string) => {
    setEditingBlocks((prev) => {
      const updated = { ...prev };
      delete updated[slotId];
      return updated;
    });
  }, []);

  const handleInsertBlock = useCallback(async (
    prevSlotId: string | null,
    blockType: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE'
  ) => {
    if (isAttemptBranch) return;

    setSaving(true);
    setError(null);
    
    const prevIndex = prevSlotId
      ? blocks.findIndex((b) => b.slot_id === prevSlotId)
      : -1;
    const nextSlotId = prevIndex < blocks.length - 1 ? blocks[prevIndex + 1]?.slot_id : null;

    const defaultContent = getDefaultContent(blockType);

    try {
      const result = await insertBlock({
        noteId: note.note_id,
        prevSlotId,
        nextSlotId,
        blockType,
        content: defaultContent,
      });

      if (result.success && result.slotId) {
        const newBlock: Block = {
          slot_id: result.slotId,
          lexorank_key: result.lexorankKey || '1|100000',
          block_type: blockType,
          content_text: result.contentText || defaultContent,
          version_id: result.versionId || '',
          author_username: user.username,
          created_at: new Date().toISOString(),
        };

        setBlocks((prev) => {
          if (!prevSlotId) {
            return [newBlock, ...prev];
          }
          const index = prev.findIndex((b) => b.slot_id === prevSlotId);
          if (index === -1) {
            return [...prev, newBlock];
          }
          const next = [...prev];
          next.splice(index + 1, 0, newBlock);
          return next;
        });

        setShowInsertMenu(null);
        router.refresh();
      } else {
        setError(result.error || 'Failed to insert block');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to insert block');
    } finally {
      setSaving(false);
    }
  }, [blocks, isAttemptBranch, note.note_id, router, currentBranch]);

  const handleDeleteBlock = useCallback(async (slotId: string) => {
    if (isAttemptBranch) return;
    if (!confirm('Delete this block? This action cannot be undone.')) return;

    setSaving(true);
    setError(null);

    try {
      const result = await deleteBlock({
        noteId: note.note_id,
        slotId,
      });

      if (result.success) {
        setBlocks((prev) => prev.filter((b) => b.slot_id !== slotId));
        router.refresh();
      } else {
        setError(result.error || 'Failed to delete block');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete block');
    } finally {
      setSaving(false);
    }
  }, [note.note_id, router]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (isAttemptBranch || !over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.slot_id === active.id);
    const newIndex = blocks.findIndex((b) => b.slot_id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newBlocks = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(newBlocks);

    const newPrevSlotId = newIndex > 0 ? newBlocks[newIndex - 1].slot_id : null;
    const newNextSlotId = newIndex < newBlocks.length - 1 ? newBlocks[newIndex + 1].slot_id : null;

    setSaving(true);
    setError(null);

    try {
      const result = await reorderBlock({
        noteId: note.note_id,
        slotId: active.id as string,
        newPrevSlotId,
        newNextSlotId,
      });

      if (result.success) {
        router.refresh();
      } else {
        setBlocks(blocks);
        setError(result.error || 'Failed to reorder block');
      }
    } catch (err: any) {
      setBlocks(blocks);
      setError(err.message || 'Failed to reorder block');
    } finally {
      setSaving(false);
    }
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

  const activeBlock = activeId ? blocks.find((b) => b.slot_id === activeId) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition-all shrink-0"
              title="Return to Dashboard"
            >
              <Home className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}`}
              className="p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-all shrink-0"
              title="Return to note"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate mb-0.5">
                <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <Link href={`/dashboard/notebooks/${notebookId}`} className="hover:text-zinc-300 transition-colors truncate max-w-[90px]">Notebook</Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className="text-zinc-300 truncate max-w-[120px]">{note.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-zinc-100 truncate">{note.title}</h1>
                <span className="text-[11px] text-zinc-500">
                  • {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
                  {saving && <span className="text-emerald-400 font-medium ml-1.5 animate-pulse">• Saving...</span>}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Branch Switcher */}
            {branches.length > 0 && currentBranch && (
              <div className="relative branch-switcher">
                <button
                  onClick={() => setShowBranchMenu(!showBranchMenu)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-2 ${
                    currentBranch.is_main
                      ? 'bg-zinc-850/80 hover:bg-zinc-800 border-zinc-700/60 text-zinc-200'
                      : 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="font-mono">{currentBranch.branch_name}</span>
                  {currentBranch.is_main ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      MAIN
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ATTEMPT
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>

                {showBranchMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-zinc-900 rounded-xl shadow-2xl border border-white/[0.08] py-1.5 min-w-[220px] z-50 animate-popover-in divide-y divide-zinc-800/70">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Switch Branch
                    </div>
                    <div className="py-1">
                      {branches
                        .filter(b => !b.is_merged)
                        .map(branch => (
                          <button
                            key={branch.branch_id}
                            onClick={() => {
                              setShowBranchMenu(false);
                              router.push(
                                `/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit${
                                  branch.is_main ? '' : `?branch=${branch.branch_id}`
                                }`
                              );
                            }}
                            className={`w-full px-3 py-1.5 text-left hover:bg-zinc-800/80 transition-colors flex items-center gap-2 text-xs ${
                              branch.branch_id === currentBranch.branch_id
                                ? 'text-emerald-400 bg-emerald-500/10 font-medium'
                                : 'text-zinc-300'
                            }`}
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span className="font-mono truncate flex-1">{branch.branch_name}</span>
                            {branch.is_main && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                                MAIN
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setShowBranchMenu(false);
                          router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/branches`);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-zinc-800/80 transition-colors text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-between"
                      >
                        <span>View All Branches</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}`)}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* Branch Awareness Banner for Non-Main Branches */}
        {currentBranch && !currentBranch.is_main && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <GitBranch className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Editing on branch: <strong className="font-mono text-amber-200">{currentBranch.branch_name}</strong>. Changes here are isolated to this attempt.
                </span>
              </div>
              <Link
                href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/branches?reviewBranchId=${currentBranch.branch_id}`}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 border border-amber-500/30"
              >
                <span>Review & Merge</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-950/50 border-b border-red-900/50 px-6 py-3">
            <div className="max-w-5xl mx-auto flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selection Menu */}
      {selectionMenu && (
        <SelectionMenu
          position={selectionMenu.position}
          onSplitAs={handleSplitBlock}
          onClose={() => setSelectionMenu(null)}
        />
      )}

      {/* Editor */}
      <div className="max-w-4xl mx-auto px-6 py-12 animate-page-in">
        <div className="space-y-4">
          {/* Scoped Revision Mode Banner */}
          {isAttemptBranch && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 shadow-lg shadow-amber-500/5">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                  Scoped Revision Mode
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-normal border border-amber-500/40">
                    {currentBranch?.branch_name}
                  </span>
                </h4>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  You are editing on an issue attempt branch. Per BookWorm&apos;s zero-conflict isolation model, only the targeted block is editable on this branch. All other blocks are locked as read-only to guarantee collision-free merges.
                </p>
              </div>
            </div>
          )}

          {/* Insert at start (only on main branch) */}
          {!isAttemptBranch && (
            <div className="relative">
              <button
                onClick={() => setShowInsertMenu(showInsertMenu === 'start' ? null : 'start')}
                disabled={saving}
                className="w-full py-2 border-2 border-dashed border-zinc-800 hover:border-emerald-500 rounded-lg text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Insert block (Ctrl+Enter)</span>
              </button>

              {showInsertMenu === 'start' && (
                <div className="absolute top-full left-0 mt-2 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 p-2 z-10 min-w-[200px]">
                  <button
                    onClick={() => handleInsertBlock(null, 'PARAGRAPH')}
                    className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                  >
                    <AlignLeft className="w-4 h-4" /> Paragraph
                  </button>
                  <button
                    onClick={() => handleInsertBlock(null, 'HEADING')}
                    className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                  >
                    <Type className="w-4 h-4" /> Heading
                  </button>
                  <button
                    onClick={() => handleInsertBlock(null, 'CODE')}
                    className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                  >
                    <Code className="w-4 h-4" /> Code
                  </button>
                  <button
                    onClick={() => handleInsertBlock(null, 'QUOTE')}
                    className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                  >
                    <Quote className="w-4 h-4" /> Quote
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Blocks with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.slot_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {blocks.map((block) => {
                  const isEditing = editingBlocks[block.slot_id] !== undefined;
                  const displayContent = isEditing
                    ? editingBlocks[block.slot_id]
                    : block.content_text;

                  const isLocked = isAttemptBranch && targetSlotId ? block.slot_id !== targetSlotId : false;
                  const isTarget = isAttemptBranch && targetSlotId ? block.slot_id === targetSlotId : false;

                  // Get or create ref for this block
                  if (!textareaRefs.current[block.slot_id]) {
                    textareaRefs.current[block.slot_id] = React.createRef<HTMLTextAreaElement>();
                  }

                  return (
                    <div key={block.slot_id} className="space-y-4">
                      <SortableBlock
                        block={block}
                        isEditing={isEditing}
                        editContent={displayContent}
                        onContentChange={(content) => handleContentChange(block.slot_id, content)}
                        onSave={() => handleSaveBlock(block.slot_id)}
                        onCancel={() => handleCancelEdit(block.slot_id)}
                        onDelete={() => handleDeleteBlock(block.slot_id)}
                        saving={saving}
                        getBlockIcon={getBlockIcon}
                        showSuccess={successBlocks.has(block.slot_id)}
                        onTextSelect={handleTextSelect}
                        textareaRef={textareaRefs.current[block.slot_id]}
                        isLocked={isLocked}
                        isTarget={isTarget}
                        targetReason={currentBranch?.issue_title || undefined}
                      />

                      {/* Insert after this block (only on main branch) */}
                      {!isAttemptBranch && (
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
                            <div className="absolute top-full left-0 mt-2 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 p-2 z-10 min-w-[200px]">
                              <button
                                onClick={() => handleInsertBlock(block.slot_id, 'PARAGRAPH')}
                                className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                              >
                                <AlignLeft className="w-4 h-4" /> Paragraph
                              </button>
                              <button
                                onClick={() => handleInsertBlock(block.slot_id, 'HEADING')}
                                className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                              >
                                <Type className="w-4 h-4" /> Heading
                              </button>
                              <button
                                onClick={() => handleInsertBlock(block.slot_id, 'CODE')}
                                className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                              >
                                <Code className="w-4 h-4" /> Code
                              </button>
                              <button
                                onClick={() => handleInsertBlock(block.slot_id, 'QUOTE')}
                                className="w-full px-4 py-2 text-left hover:bg-zinc-700 rounded flex items-center gap-2 text-zinc-200"
                              >
                                <Quote className="w-4 h-4" /> Quote
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeBlock ? (
                <div className="bg-zinc-900 rounded-lg border border-emerald-500 shadow-xl p-4 opacity-90">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-zinc-800 text-zinc-400">
                      {getBlockIcon(activeBlock.block_type)}
                    </div>
                    <div className="font-mono text-sm text-zinc-300 truncate max-w-md">
                      {activeBlock.content_text.substring(0, 100)}...
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {blocks.length === 0 && (
            <div className="text-center py-20 text-zinc-500">
              <AlignLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No blocks yet</p>
              <p className="text-sm">Click "Insert block" above to get started</p>
              <p className="text-xs mt-4 text-zinc-600">
                <Scissors className="w-3 h-3 inline mr-1" />
                Pro tip: Select text in any block and press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+/</kbd> to split it
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
