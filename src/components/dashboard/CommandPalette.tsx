'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  BookOpen,
  Folder,
  CircleDot,
  FileText,
  BookMarked,
  X,
  Loader2,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
} from 'lucide-react';
import { globalSearch, type SearchResultItem, type GlobalSearchResponse } from '@/actions/search';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreate?: (type: 'notebook' | 'note' | 'issue' | 'branch' | 'fork') => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onOpenCreate,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'NOTEBOOK' | 'NOTE' | 'BLOCK' | 'ISSUE' | 'EDITION'>('ALL');
  const [results, setResults] = useState<GlobalSearchResponse['results'] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced live search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await globalSearch(query);
        if (res.success && res.results) {
          setResults(res.results);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('CommandPalette search error:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Flatten results according to active category filter
  const displayedItems: SearchResultItem[] = React.useMemo(() => {
    if (!results) return [];
    let items: SearchResultItem[] = [];

    if (activeCategory === 'ALL' || activeCategory === 'NOTE') {
      items = items.concat(results.notes);
    }
    if (activeCategory === 'ALL' || activeCategory === 'NOTEBOOK') {
      items = items.concat(results.notebooks);
    }
    if (activeCategory === 'ALL' || activeCategory === 'BLOCK') {
      items = items.concat(results.blocks);
    }
    if (activeCategory === 'ALL' || activeCategory === 'ISSUE') {
      items = items.concat(results.issues);
    }
    if (activeCategory === 'ALL' || activeCategory === 'EDITION') {
      items = items.concat(results.editions);
    }

    return items;
  }, [results, activeCategory]);

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < displayedItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : displayedItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayedItems[selectedIndex]) {
        handleSelectItem(displayedItems[selectedIndex]);
      }
    }
  };

  const handleSelectItem = (item: SearchResultItem) => {
    onClose();
    router.push(item.url);
  };

  const getItemIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'NOTEBOOK':
        return <Folder className="w-4 h-4 text-purple-400" />;
      case 'NOTE':
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case 'BLOCK':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'ISSUE':
        return <CircleDot className="w-4 h-4 text-amber-400" />;
      case 'EDITION':
        return <BookMarked className="w-4 h-4 text-cyan-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-800 bg-zinc-950/70 gap-3">
          <Search className="w-5 h-5 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, notebooks, blocks, issues, editions..."
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-950/40 border-b border-zinc-800/80 overflow-x-auto text-[11px] font-medium">
          {(['ALL', 'NOTE', 'NOTEBOOK', 'BLOCK', 'ISSUE', 'EDITION'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                activeCategory === cat
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {cat === 'ALL' ? 'All Results' : cat.charAt(0) + cat.slice(1).toLowerCase() + 's'}
            </button>
          ))}
        </div>

        {/* Results / Empty / Quick Shortcuts Area */}
        <div className="max-h-96 overflow-y-auto p-2">
          {displayedItems.length > 0 ? (
            <div className="space-y-1">
              {displayedItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}-${idx}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3 rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/80 shadow-sm'
                        : 'text-zinc-300 hover:bg-zinc-800/50 border border-transparent'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 shrink-0 mt-0.5">
                      {getItemIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-100 truncate">
                          {item.title}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                      {item.snippet && (
                        <p className="text-[11px] text-zinc-400 italic bg-zinc-950/40 p-1.5 rounded mt-1 line-clamp-1 border border-zinc-800/60">
                          {item.snippet}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-zinc-400 shrink-0 self-center" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : query.trim().length >= 2 && !loading ? (
            <div className="text-center py-12 text-zinc-500 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs">No matching notes, notebooks, or blocks found for "{query}"</p>
            </div>
          ) : (
            /* Quick Action Shortcuts when search query is empty */
            <div className="p-3 space-y-3">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-2">
                Quick Shortcuts & Actions
              </div>
              <div className="space-y-1">
                {onOpenCreate && (
                  <>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenCreate('note');
                      }}
                      className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-zinc-800/60 text-xs text-zinc-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>Create a new note</span>
                      </div>
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">N</kbd>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenCreate('notebook');
                      }}
                      className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-zinc-800/60 text-xs text-zinc-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-4 h-4 text-purple-400" />
                        <span>Create a new notebook</span>
                      </div>
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">B</kbd>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    onClose();
                    router.push('/explore');
                  }}
                  className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-zinc-800/60 text-xs text-zinc-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Explore public community notes</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
