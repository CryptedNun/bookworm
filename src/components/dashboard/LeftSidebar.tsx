"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Folder,
  FolderOpen,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  Lock,
  Star,
  CircleDot,
  Settings,
  Layers,
  FileText,
  GitBranch,
} from "lucide-react";
import {
  currentUser,
  sampleNotebooks,
  sampleContributedNotes,
  NoteItem,
} from "@/lib/mock-data";

interface LeftSidebarProps {
  onOpenProfile: () => void;
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
  onSelectNote?: (note: NoteItem) => void;
}

export function LeftSidebar({
  onOpenProfile,
  onOpenCreate,
  onSelectNote,
}: LeftSidebarProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "owned" | "contributed" | "starred">("all");
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({
    "nb-cs101": true,
    "nb-web-arch": true,
  });

  const toggleNotebook = (id: string) => {
    setExpandedNotebooks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredNotebooks = sampleNotebooks.filter((nb) => {
    if (activeTab === "contributed") return false;
    if (activeTab === "starred" && !nb.isStarred) return false;
    if (!filterQuery) return true;
    const matchNb = nb.title.toLowerCase().includes(filterQuery.toLowerCase());
    const matchNotes = nb.notes.some((n) =>
      n.title.toLowerCase().includes(filterQuery.toLowerCase())
    );
    return matchNb || matchNotes;
  });

  const filteredContributed = sampleContributedNotes.filter((note) => {
    if (activeTab === "owned") return false;
    if (activeTab === "starred" && !note.isStarred) return false;
    if (!filterQuery) return true;
    return (
      note.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (note.description && note.description.toLowerCase().includes(filterQuery.toLowerCase()))
    );
  });

  return (
    <aside className="w-full lg:w-80 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-[calc(100vh-53px)] sticky top-[53px] overflow-hidden select-none">
      {/* 1. TOP SECTION: Profile Icon & Header (Clickable for Settings) */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950">
        <button
          onClick={onOpenProfile}
          className="w-full p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-emerald-500/40 transition-all flex items-center justify-between group cursor-pointer text-left shadow-sm"
          title="Click to view profile settings & capabilities"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/40 group-hover:ring-emerald-400 transition-all"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                  {currentUser.name}
                </span>
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">@{currentUser.username}</p>
            </div>
          </div>

          <div className="p-1.5 rounded-lg text-zinc-400 group-hover:text-emerald-400 group-hover:bg-zinc-800 transition-colors">
            <Settings className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* 2. BENEATH PROFILE: Notes and Notebooks Explorer Header */}
      <div className="p-3.5 pb-2 border-b border-zinc-800/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Notes & Notebooks</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onOpenCreate("notebook")}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-purple-400 border border-zinc-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
              title="New Notebook"
            >
              <Folder className="w-3 h-3 text-purple-400" />
              <Plus className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => onOpenCreate("note")}
              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors text-xs flex items-center gap-1 cursor-pointer font-medium"
              title="New Note"
            >
              <Plus className="w-3 h-3" />
              <span className="text-[11px]">New</span>
            </button>
          </div>
        </div>

        {/* Search Input for Repos/Notebooks */}
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter notes & notebooks..."
            className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg bg-zinc-900/70 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
          />
        </div>

        {/* Filter Tabs (Like GitHub: All / Owned / Contributed / Starred) */}
        <div className="flex items-center gap-1 text-[11px] font-medium border-b border-zinc-800/40 pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("owned")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === "owned"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Owned ({sampleNotebooks.length})
          </button>
          <button
            onClick={() => setActiveTab("contributed")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === "contributed"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Contributed ({sampleContributedNotes.length})
          </button>
          <button
            onClick={() => setActiveTab("starred")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === "starred"
                ? "bg-zinc-800 text-amber-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Star className="w-2.5 h-2.5 text-amber-400" />
            Starred
          </button>
        </div>
      </div>

      {/* 3. SCROLLABLE DIRECTORY: Possessions & Contributions */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* SECTION A: OWNED NOTEBOOKS & NOTES */}
        {filteredNotebooks.length > 0 && (
          <div className="space-y-1.5">
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
              <span>Your Notebooks (Possessions)</span>
              <span>{filteredNotebooks.length}</span>
            </div>

            <div className="space-y-1">
              {filteredNotebooks.map((nb) => {
                const isExpanded = !!expandedNotebooks[nb.id];
                return (
                  <div
                    key={nb.id}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden"
                  >
                    {/* Notebook Header */}
                    <button
                      onClick={() => toggleNotebook(nb.id)}
                      className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        )}
                        <span className="font-semibold text-zinc-200 truncate text-[11px] group-hover:text-purple-300">
                          {nb.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-zinc-500">
                        {nb.visibility === "PRIVATE" ? (
                          <Lock className="w-2.5 h-2.5 text-zinc-400" />
                        ) : (
                          <Globe className="w-2.5 h-2.5 text-zinc-500" />
                        )}
                        <span className="text-[10px] font-mono bg-zinc-800/80 px-1.5 py-0.2 rounded text-zinc-400">
                          {nb.notes.length}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-zinc-500" />
                        )}
                      </div>
                    </button>

                    {/* Notebook Notes List */}
                    {isExpanded && (
                      <div className="px-2 pb-2 pt-0.5 space-y-0.5 border-t border-zinc-800/40 bg-zinc-950/40">
                        {nb.notes.map((note) => (
                          <button
                            key={note.id}
                            onClick={() => onSelectNote?.(note)}
                            className="w-full px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors flex items-center justify-between text-left cursor-pointer group/note"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="text-zinc-300 group-hover/note:text-emerald-300 text-[11px] truncate">
                                {note.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono shrink-0">
                              {note.openIssuesCount > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                  <CircleDot className="w-2 h-2" />
                                  {note.openIssuesCount}
                                </span>
                              )}
                              <span className="text-zinc-500 text-[9px]">{note.defaultEdition}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION B: CONTRIBUTED NOTES (Like GitHub Repos Contributed To) */}
        {filteredContributed.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-400" />
                Contributed Notes
              </span>
              <span>{filteredContributed.length}</span>
            </div>

            <div className="space-y-1">
              {filteredContributed.map((note) => (
                <div
                  key={note.id}
                  onClick={() => onSelectNote?.(note)}
                  className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="font-semibold text-zinc-200 group-hover:text-blue-300 text-[11px] truncate">
                        {note.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                        note.role === "MAINTAINER"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}
                    >
                      {note.role}
                    </span>
                  </div>

                  {note.description && (
                    <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
                      {note.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1 font-mono">
                      <GitBranch className="w-2.5 h-2.5 text-zinc-400" />
                      {note.branchesCount} branches
                    </span>
                    {note.openIssuesCount > 0 && (
                      <span className="flex items-center gap-1 font-mono text-amber-400">
                        <CircleDot className="w-2.5 h-2.5" />
                        {note.openIssuesCount} issues
                      </span>
                    )}
                    <span className="ml-auto text-zinc-500 text-[9px]">{note.lastUpdated}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty Search Fallback */}
        {filteredNotebooks.length === 0 && filteredContributed.length === 0 && (
          <div className="p-6 text-center text-zinc-500 text-xs">
            <p>No notes or notebooks found matching "{filterQuery}"</p>
          </div>
        )}
      </div>
    </aside>
  );
}

