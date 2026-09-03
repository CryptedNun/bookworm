"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  GitBranch,
  Search,
  CircleDot,
  GitPullRequest,
  BookMarked,
  Bell,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  GitFork,
  Check,
  X,
  User as UserIcon,
  Shield,
  Key,
  Database,
  LogOut,
  GitCommit,
  Layers,
  Sparkles,
  Lock,
  Globe,
  EyeOff,
  Star,
  Settings,
  Clock,
  CheckCircle2,
  GitMerge,
  Eye,
  Edit,
  ArrowRight,
} from "lucide-react";
import VersionControlGuide from "@/components/dashboard/VersionControlGuide";
import UnmergedBranchesWidget from "@/components/dashboard/UnmergedBranchesWidget";
import StorageAndActivityWidget from "@/components/dashboard/StorageAndActivityWidget";
import type { UnmergedBranchItem, DashboardNoteItem, StorageAnalytics, ActivityItem } from "@/actions/dashboard";
import ForkNoteModal from "@/components/notes/ForkNoteModal";
import { TopNav } from "@/components/dashboard/TopNav";
import type { StarredResourceItem } from "@/actions/stars";

// ==========================================
// 1. DATA MODELS & SAMPLE DATA
// ==========================================

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio: string;
  role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  joinedDate: string;
  capabilities: {
    canCreateIssue: boolean;
    canDeleteBranch: boolean;
    canMergeBranch: boolean;
    canAddContributor: boolean;
  };
  stats: {
    notebooksCount: number;
    notesCount: number;
    contributedCount: number;
    issuesCount: number;
    commitsCount: number;
  };
}

export interface NoteItem {
  id: string;
  notebookId: string;
  title: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  defaultEdition: string;
  lastUpdated: string;
  blocksCount: number;
  branchesCount: number;
  openIssuesCount: number;
  isStarred?: boolean;
}

export interface NotebookItem {
  id: string;
  title: string;
  description: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  notesCount: number;
  lastUpdated: string;
  isStarred?: boolean;
  notes: NoteItem[];
}

export interface NotificationItem {
  id: string;
  type: 'ACCESS_REQUEST' | 'ISSUE_ASSIGNED' | 'BRANCH_MERGED' | 'EDITION_PUBLISHED';
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
}





// ==========================================
// 3. LEFT SIDEBAR COMPONENT
// ==========================================

export function LeftSidebar({
  user,
  notebooks,
  dashboardNotes = [],
  userRoles = [],
  starredItems = [],
  onOpenProfile,
  onOpenCreate,
  onSelectNote,
}: {
  user: UserWithStats;
  notebooks: Notebook[];
  dashboardNotes?: DashboardNoteItem[];
  userRoles?: Array<{ notebook_id: string; role_type: string }>;
  starredItems?: StarredResourceItem[];
  onOpenProfile: () => void;
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
  onSelectNote?: (note: NoteItem) => void;
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "owned" | "contributed" | "starred">("all");
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({
    [notebooks[0]?.notebook_id]: true, // Expand first notebook by default
  });

  const toggleNotebook = (id: string) => {
    setExpandedNotebooks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Transform real notebooks with their real notes and user roles
  const notebooksWithNotes = notebooks.map(nb => {
    const role = userRoles.find(r => r.notebook_id === nb.notebook_id)?.role_type || 'OWNER';
    const nbNotes = dashboardNotes.filter(n => n.notebook_id === nb.notebook_id);
    return {
      id: nb.notebook_id,
      title: nb.title,
      description: nb.description || '',
      visibility: nb.visibility,
      notesCount: nbNotes.length || nb.notes_count || 0,
      role: role as 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR',
      isStarred: false,
      notes: nbNotes.map(n => ({
        id: n.note_id,
        notebookId: n.notebook_id,
        title: n.title,
        openIssuesCount: n.open_issues_count,
        defaultEdition: 'main',
        blocksCount: n.blocks_count,
        branchesCount: n.active_branches_count,
      })),
    };
  });

  const ownedNotebooks = notebooksWithNotes.filter(nb => nb.role === 'OWNER');
  const contributedNotebooks = notebooksWithNotes.filter(nb => nb.role !== 'OWNER');

  const filteredNotebooks = notebooksWithNotes.filter((nb) => {
    if (activeTab === "owned" && nb.role !== "OWNER") return false;
    if (activeTab === "contributed" && nb.role === "OWNER") return false;
    if (activeTab === "starred" && !nb.isStarred) return false;
    if (!filterQuery) return true;
    const matchNb = nb.title.toLowerCase().includes(filterQuery.toLowerCase());
    const matchNote = nb.notes.some(n => n.title.toLowerCase().includes(filterQuery.toLowerCase()));
    return matchNb || matchNote;
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
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm overflow-hidden ring-2 ring-emerald-500/40 group-hover:ring-emerald-400 transition-all">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.username[0]?.toUpperCase()
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                  {user.username}
                </span>
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {user.system_role || 'USER'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">@{user.username}</p>
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

        {/* Filter Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter notes & notebooks..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder:text-zinc-500 text-xs focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Categories Tabs */}
        <div className="flex items-center gap-1 text-[11px] font-medium border-b border-zinc-800/40 pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({notebooksWithNotes.length})
          </button>
          <button
            onClick={() => setActiveTab("owned")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === "owned"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Owned ({ownedNotebooks.length})
          </button>
          <button
            onClick={() => setActiveTab("contributed")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === "contributed"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Contributed ({contributedNotebooks.length})
          </button>
          <button
            onClick={() => setActiveTab("starred")}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === "starred"
                ? "bg-zinc-800 text-amber-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>Starred ({starredItems.length})</span>
          </button>
        </div>
      </div>

      {/* 3. SCROLLABLE DIRECTORY: Possessions & Contributions */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {activeTab === "starred" ? (
          <div className="space-y-2">
            {starredItems.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-xs">
                No starred items yet. Star any note or notebook to bookmark it!
              </div>
            ) : (
              starredItems.map((item) => (
                <Link
                  key={item.resource_id}
                  href={
                    item.resource_type === 'NOTE' && item.notebook_id
                      ? `/dashboard/notebooks/${item.notebook_id}/notes/${item.resource_id}`
                      : `/dashboard/notebooks/${item.resource_id}`
                  }
                  className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-amber-500/30 flex items-center justify-between gap-2 transition-all block group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {item.resource_type === 'NOTE' ? `Note in ${item.notebook_title || 'notebook'}` : 'Notebook'}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                </Link>
              ))
            )}
          </div>
        ) : filteredNotebooks.length > 0 ? (
          <div className="space-y-2">
            {filteredNotebooks.map((nb) => {
              const isExpanded = !!expandedNotebooks[nb.id];
              return (
                <div
                  key={nb.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden"
                >
                  {/* Notebook Header */}
                  <div className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-zinc-800/50 transition-colors text-left group">
                    <button
                      type="button"
                      onClick={() => toggleNotebook(nb.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90 text-zinc-300' : ''}`} />
                      <Folder className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-semibold text-zinc-200 truncate text-[11px] group-hover:text-purple-300">
                        {nb.title}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0 text-zinc-500">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                        {nb.role}
                      </span>
                      <Link
                        href={`/dashboard/notebooks/${nb.id}/manage`}
                        className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Manage notebook & collaborators"
                      >
                        <Settings className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                      </Link>
                    </div>
                  </div>

                  {/* Collapsible Notes inside Notebook */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800/60 bg-zinc-950/60 p-1.5 space-y-1">
                      {nb.notes.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-zinc-500 italic">
                          No notes in this notebook yet
                        </div>
                      ) : (
                        nb.notes.map((note) => (
                          <Link
                            key={note.id}
                            href={`/dashboard/notebooks/${nb.id}/notes/${note.id}`}
                            className="px-2.5 py-1.5 rounded-lg hover:bg-zinc-850 text-zinc-300 hover:text-zinc-100 flex items-center justify-between gap-2 text-[11px] transition-colors group/note"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{note.title}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-mono text-[9px]">
                              {note.openIssuesCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {note.openIssuesCount} issue{note.openIssuesCount > 1 ? 's' : ''}
                                </span>
                              )}
                              <span className="text-zinc-500">
                                {note.blocksCount} blk
                              </span>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center text-zinc-500 text-xs">
            No notebooks found matching "{filterQuery}"
          </div>
        )}
      </div>
    </aside>
  );
}

// ==========================================
// 4. HOME FEED COMPONENT
// ==========================================

export function HomeFeed({
  user,
  notebooks,
  unmergedBranches = [],
  dashboardNotes = [],
  userRoles = [],
  analytics,
  activities = [],
  starredItems = [],
  onOpenCreate,
}: {
  user: UserWithStats;
  notebooks: Notebook[];
  unmergedBranches?: UnmergedBranchItem[];
  dashboardNotes?: DashboardNoteItem[];
  userRoles?: Array<{ notebook_id: string; role_type: string }>;
  analytics?: StorageAnalytics;
  activities?: ActivityItem[];
  starredItems?: StarredResourceItem[];
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
}) {
  return (
    <main className="flex-1 min-w-0 p-4 lg:p-8 space-y-8 overflow-y-auto">
      {/* 1. Welcome Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 lg:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GitHub for Notes • Version Control Hub</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-extrabold text-zinc-100 tracking-tight">
            Welcome back, {user.username}
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Collaborate on modular notes with zero-conflict block locking, attempt branches, LexoRank ordering, and content-addressed storage (CAS).
          </p>

          {/* Quick Action Buttons */}
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
              onClick={() => onOpenCreate("fork")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitFork className="w-4 h-4 text-cyan-400" />
              Fork Note
            </button>
          </div>
        </div>
      </div>

      {/* 2. Core Architecture Real Stat Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-sm space-y-1.5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium text-[11px] uppercase tracking-wider">Total Notes</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {user.stats.notes_count} {user.stats.notes_count === 1 ? 'Note' : 'Notes'}
          </div>
          <p className="text-[11px] text-zinc-500">Across {notebooks.length} collections</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-sm space-y-1.5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium text-[11px] uppercase tracking-wider">Active Block Issues</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CircleDot className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {user.stats.issues_count} Open
          </div>
          <p className="text-[11px] text-zinc-500">Zero-conflict slot locks</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-sm space-y-1.5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium text-[11px] uppercase tracking-wider">Commit Chain</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <GitCommit className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {user.stats.commits_count} Commits
          </div>
          <p className="text-[11px] text-zinc-500">Ternary manifests linked</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-sm space-y-1.5 hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium text-[11px] uppercase tracking-wider">Storage Engine</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">CAS SHA-256</div>
          <p className="text-[11px] text-zinc-500">Zero-cost content addressed</p>
        </div>
      </div>

      {/* 3. Interactive Version Control Cheatsheet & Workflow Guide */}
      <VersionControlGuide />

      {/* 4. Action Required: Branches Awaiting Review & Merge (Only shown for maintainers with active review requests) */}
      {unmergedBranches && unmergedBranches.length > 0 && (
        <UnmergedBranchesWidget branches={unmergedBranches} />
      )}

      {/* 4.5. Storage Analytics & Unified Activity Feed */}
      {analytics && (
        <StorageAndActivityWidget
          analytics={analytics}
          activities={activities || []}
        />
      )}

      {/* 4.7. Starred Quick Access Shelf */}
      {starredItems && starredItems.length > 0 && (
        <div className="space-y-3 p-4 rounded-2xl bg-amber-950/10 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Starred Notes & Workspaces</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">{starredItems.length} Bookmarks</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {starredItems.map((st) => (
              <Link
                key={st.resource_id}
                href={
                  st.resource_type === 'NOTE' && st.notebook_id
                    ? `/dashboard/notebooks/${st.notebook_id}/notes/${st.resource_id}`
                    : `/dashboard/notebooks/${st.resource_id}`
                }
                className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between gap-2 group"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 truncate">
                    {st.title}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {st.resource_type === 'NOTE' ? `Note in ${st.notebook_title || 'notebook'}` : 'Notebook'}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 5. Workspaces & Modular Notes Explorer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-zinc-200">Your Notebooks & Notes</h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">{notebooks.length} Workspaces</span>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {notebooks.map((nb) => {
            const role = userRoles.find((r) => r.notebook_id === nb.notebook_id)?.role_type || 'OWNER';
            const notes = dashboardNotes.filter((n) => n.notebook_id === nb.notebook_id);

            return (
              <div
                key={nb.notebook_id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5 hover:border-zinc-700/80 transition-all shadow-md"
              >
                {/* Notebook Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-zinc-100">{nb.title}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {role}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700">
                        {nb.visibility}
                      </span>
                    </div>
                    {nb.description && (
                      <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                        {nb.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/notebooks/${nb.notebook_id}/manage`}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition-colors flex items-center gap-1.5"
                    >
                      <Settings className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Manage</span>
                    </Link>

                    <Link
                      href={`/dashboard/notebooks/${nb.notebook_id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read Notebook</span>
                    </Link>
                  </div>
                </div>

                {/* Notes List inside Notebook */}
                {notes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-zinc-800/80 rounded-xl text-zinc-500 text-xs">
                    <p>No notes in this notebook yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {notes.map((note) => (
                      <div
                        key={note.note_id}
                        className="p-4.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-900/90 border border-zinc-800/90 hover:border-emerald-500/40 hover:shadow-lg transition-all duration-200 flex flex-col justify-between gap-3.5 group relative"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/dashboard/notebooks/${nb.notebook_id}/notes/${note.note_id}`}
                              className="font-semibold text-xs text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-1"
                              title={note.title}
                            >
                              {note.title}
                            </Link>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                            <span>{note.blocks_count} {note.blocks_count === 1 ? 'block' : 'blocks'}</span>
                            {note.open_issues_count > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 flex items-center gap-1">
                                  <CircleDot className="w-3 h-3" />
                                  {note.open_issues_count} open issue{note.open_issues_count > 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                            {note.active_branches_count > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-purple-400 flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  {note.active_branches_count} branch{note.active_branches_count > 1 ? 'es' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Note Actions Toolbar */}
                        <div className="pt-2 border-t border-zinc-850/80 flex items-center justify-between text-xs">
                          <Link
                            href={`/dashboard/notebooks/${nb.notebook_id}/notes/${note.note_id}`}
                            className="text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1 text-[11px]"
                          >
                            <Eye className="w-3 h-3 text-zinc-500" />
                            <span>Read</span>
                          </Link>

                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/dashboard/notebooks/${nb.notebook_id}/notes/${note.note_id}/tree`}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors"
                              title="Commit Tree Graph"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                            </Link>

                            <Link
                              href={`/dashboard/notebooks/${nb.notebook_id}/notes/${note.note_id}/branches`}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-purple-400 transition-colors"
                              title="Branches"
                            >
                              <GitFork className="w-3.5 h-3.5" />
                            </Link>

                            <Link
                              href={`/dashboard/notebooks/${nb.notebook_id}/notes/${note.note_id}/issues`}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
                              title="Issues"
                            >
                              <CircleDot className="w-3.5 h-3.5" />
                            </Link>

                            <Link
                              href={`/dashboard/notebooks/${nb.notebook_id}/notes/${note.note_id}/edit`}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                              title="Block Editor"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ==========================================
// 5. PROFILE MODAL COMPONENT
// ==========================================

export function ProfileModal({
  user,
  isOpen,
  onClose,
}: {
  user: UserWithStats;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "permissions" | "storage" | "keys">("profile");

  if (!isOpen) return null;

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('@/actions/auth');
      await signOut();
      // signOut() redirects using redirect() which throws NEXT_REDIRECT
      // This is expected behavior in Next.js and handled by the framework
    } catch (error: any) {
      // Check if it's the expected Next.js redirect
      if (error?.message === 'NEXT_REDIRECT' || error?.digest?.includes('NEXT_REDIRECT')) {
        // This is expected - redirect is working
        return;
      }
      // Only show alert for actual errors
      alert('Sign out error: ' + error.message);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Profile Settings & Workspace</h2>
              <p className="text-xs text-zinc-400">Manage account, collaborative roles & storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/30 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("profile")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "profile"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Profile & Overview
          </button>
          <button
            onClick={() => setActiveTab("permissions")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "permissions"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Roles & Capabilities
          </button>
          <button
            onClick={() => setActiveTab("storage")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "storage"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Storage & CAS
          </button>
          <button
            onClick={() => setActiveTab("keys")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "keys"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            API & Security
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Profile Card Summary */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl overflow-hidden ring-2 ring-emerald-500/40">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.username[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-100">{user.username}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {user.system_role || 'USER'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">@{user.username} • {user.email}</p>
                  <p className="text-xs text-zinc-300 pt-1">Collaborative author on BookWorm CAS platform</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <Folder className="w-3.5 h-3.5 text-purple-400" />
                    Notebooks
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{user.stats.notebooks_count}</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Notes Owned
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{user.stats.notes_count}</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Contributed
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{user.stats.contributed_count}</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <GitCommit className="w-3.5 h-3.5 text-amber-400" />
                    Commits
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{user.stats.commits_count}</div>
                </div>
              </div>

              {/* Account Details Form */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Account Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Username</label>
                    <input
                      type="text"
                      readOnly
                      defaultValue={user.username}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      readOnly
                      defaultValue={user.email}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "permissions" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                  <Shield className="w-4 h-4" />
                  Role-Based Access Control (RBAC)
                </div>
                <p className="text-xs text-zinc-300">
                  You are registered as an <strong className="text-emerald-400">OWNER</strong> with full resource supertype permissions across notebooks and notes.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Active Capabilities</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                    <span className="text-zinc-300">can_create_issue</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">true</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                    <span className="text-zinc-300">can_merge_branch</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">true</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                    <span className="text-zinc-300">can_delete_branch</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">true</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                    <span className="text-zinc-300">can_add_contributor</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">true</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "storage" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
                  <Database className="w-4 h-4" />
                  Content-Addressed Storage & Zero-Cost Deduplication
                </div>
                <p className="text-zinc-300">
                  BookWorm stores text blobs by SHA-256 hash. When notes are forked or edited, unchanged blocks share existing content blobs.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                  <span className="text-zinc-400 text-[11px]">Unique Content Blobs</span>
                  <div className="text-lg font-bold text-zinc-100 font-mono mt-1">248 Blobs</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                  <span className="text-zinc-400 text-[11px]">Slot References</span>
                  <div className="text-lg font-bold text-zinc-100 font-mono mt-1">1,420 Slots</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800">
                  <span className="text-zinc-400 text-[11px]">Storage Efficiency</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">82.5% saved</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "keys" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">Local Personal Access Token</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Expires in 90 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    readOnly
                    value="bw_pat_9a87f6e5d4c3b2a10011223344"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-zinc-300 text-xs"
                  />
                  <button
                    onClick={() => alert("Copied PAT to clipboard!")}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. CREATE RESOURCE MODAL
// ==========================================

export function CreateModal({
  isOpen,
  initialType,
  notebooks = [],
  dashboardNotes = [],
  userRoles = [],
  userId,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  initialType: "notebook" | "note" | "issue" | "branch" | "fork";
  notebooks?: Array<{ notebook_id: string; title: string; owner_id?: string; }>;
  dashboardNotes?: DashboardNoteItem[];
  userRoles?: Array<{ notebook_id: string; role_type: string; }>;
  userId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const [activeType, setActiveType] = useState<"notebook" | "note" | "issue" | "branch" | "fork">(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE");

  // Notebooks where user has permission to create issues (OWNER, MAINTAINER, or CONTRIBUTOR)
  const issuePermittedNotebooks = React.useMemo(() => {
    return (notebooks || []).filter((nb) => {
      const isOwner = (nb as any).owner_id === userId;
      const role = userRoles?.find((r) => r.notebook_id === nb.notebook_id)?.role_type;
      return isOwner || ['OWNER', 'MAINTAINER', 'CONTRIBUTOR'].includes(role || '');
    });
  }, [notebooks, userRoles, userId]);

  // Notebooks where user has permission to create notes (OWNER or MAINTAINER)
  const notePermittedNotebooks = React.useMemo(() => {
    return (notebooks || []).filter((nb) => {
      const isOwner = (nb as any).owner_id === userId;
      const role = userRoles?.find((r) => r.notebook_id === nb.notebook_id)?.role_type;
      return isOwner || ['OWNER', 'MAINTAINER'].includes(role || '');
    });
  }, [notebooks, userRoles, userId]);

  const [selectedNotebook, setSelectedNotebook] = useState<string>("");
  
  // Cascading Issue Selector States
  const [issueNotebookId, setIssueNotebookId] = useState<string>("");
  const [issueNoteId, setIssueNoteId] = useState<string>("");
  const [issueBlocks, setIssueBlocks] = useState<Array<{ slot_id: string; block_type: string; content_text: string }>>([]);
  const [issueSlotId, setIssueSlotId] = useState<string>("");
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available notes for the selected notebook where user has contributor/maintainer/owner role
  const notesInSelectedNotebook = React.useMemo(
    () => dashboardNotes.filter((n) => n.notebook_id === issueNotebookId && (n as any).role_type !== 'VIEWER'),
    [dashboardNotes, issueNotebookId]
  );

  // Synchronize initial notebook selection for notes and issues based on permissions
  React.useEffect(() => {
    if (!isOpen) return;
    if (notePermittedNotebooks.length > 0 && (!selectedNotebook || !notePermittedNotebooks.some(nb => nb.notebook_id === selectedNotebook))) {
      setSelectedNotebook(notePermittedNotebooks[0].notebook_id);
    }
  }, [isOpen, notePermittedNotebooks, selectedNotebook]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (issuePermittedNotebooks.length > 0 && (!issueNotebookId || !issuePermittedNotebooks.some(nb => nb.notebook_id === issueNotebookId))) {
      setIssueNotebookId(issuePermittedNotebooks[0].notebook_id);
    } else if (issuePermittedNotebooks.length === 0) {
      setIssueNotebookId("");
    }
  }, [isOpen, issuePermittedNotebooks, issueNotebookId]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (notesInSelectedNotebook.length > 0) {
      if (!issueNoteId || !notesInSelectedNotebook.some((n) => n.note_id === issueNoteId)) {
        setIssueNoteId(notesInSelectedNotebook[0].note_id);
      }
    } else if (issueNoteId !== "") {
      setIssueNoteId("");
      setIssueBlocks([]);
      setIssueSlotId("");
    }
  }, [isOpen, notesInSelectedNotebook, issueNoteId]);

  // Fetch blocks when selected note changes
  React.useEffect(() => {
    if (!isOpen) return;
    if (activeType === "issue" && issueNoteId) {
      setIsLoadingBlocks(true);
      import('@/actions/notes').then(({ getNoteWithBlocks }) => {
        getNoteWithBlocks(issueNoteId)
          .then((res) => {
            if (res.success && 'note' in res && res.note && Array.isArray((res.note as any).blocks)) {
              const blocks = (res.note as any).blocks;
              setIssueBlocks(blocks);
              setIssueSlotId(blocks[0]?.slot_id || "");
            } else {
              setIssueBlocks([]);
              setIssueSlotId("");
            }
          })
          .catch((err) => {
            console.error('Failed to load blocks:', err);
            setIssueBlocks([]);
          })
          .finally(() => {
            setIsLoadingBlocks(false);
          });
      });
    }
  }, [activeType, issueNoteId]);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setVisibility("PRIVATE");
      setError(null);
      setActiveType(initialType);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (activeType === "notebook") {
        const { createNotebook } = await import('@/actions/notebooks');
        const result = await createNotebook({
          title,
          description,
          visibility,
          userId,
        });

        if (result.success) {
          onSuccess(`Notebook "${title}" created successfully!`);
          onClose();
        } else {
          setError(result.error || 'Failed to create notebook');
        }
      } else if (activeType === "note") {
        const targetNb = selectedNotebook || notebooks[0]?.notebook_id;
        if (!targetNb) {
          setError('Please select or create a notebook first');
          return;
        }

        const { createNote } = await import('@/actions/notes');
        const result = await createNote({
          notebookId: targetNb,
          title,
          description,
          visibility,
          userId,
        });

        if (result.success) {
          onSuccess(`Note "${title}" created successfully!`);
          onClose();
        } else {
          setError(result.error || 'Failed to create note');
        }
      } else if (activeType === "issue") {
        if (!issueNoteId) {
          setError('Please select a note to target');
          return;
        }
        if (!issueSlotId) {
          setError('Please select a block to target with this issue');
          return;
        }

        const { createIssue } = await import('@/actions/issues');
        const result = await createIssue({
          noteId: issueNoteId,
          slotId: issueSlotId,
          title: title.trim(),
          description: description.trim() || undefined,
        });

        if (result.success && result.issue) {
          onSuccess(`Issue created! Attempt branch "${result.issue.branch_name}" ready.`);
          onClose();
          router.push(`/dashboard/notebooks/${issueNotebookId}/notes/${issueNoteId}/edit?branch=${result.issue.branch_id}`);
        } else {
          setError(result.error || 'Failed to create issue');
        }
      } else {
        onSuccess(`Resource created successfully!`);
        onClose();
      }
    } catch (err: any) {
      console.error('CreateModal: Exception caught:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-zinc-100">Create Resource</h3>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeType}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Selector Pills */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-2 gap-1.5 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveType("note")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeType === "note"
                ? "bg-zinc-800 text-emerald-400 border border-zinc-700 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Note
          </button>
          <button
            type="button"
            onClick={() => setActiveType("notebook")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeType === "notebook"
                ? "bg-zinc-800 text-purple-400 border border-zinc-700 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Notebook
          </button>
          <button
            type="button"
            onClick={() => setActiveType("issue")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeType === "issue"
                ? "bg-zinc-800 text-amber-400 border border-zinc-700 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            Issue
          </button>
          <button
            type="button"
            onClick={() => setActiveType("branch")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeType === "branch"
                ? "bg-zinc-800 text-blue-400 border border-zinc-700 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Branch
          </button>
          <button
            type="button"
            onClick={() => setActiveType("fork")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeType === "fork"
                ? "bg-zinc-800 text-cyan-400 border border-zinc-700 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            Fork
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              {activeType === "issue" ? "Issue Summary / Title" : "Title / Name"}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                activeType === "notebook"
                  ? "e.g. Distributed Systems 2026"
                  : activeType === "note"
                  ? "e.g. Raft Consensus Protocol Explained"
                  : activeType === "issue"
                  ? "e.g. Fix typo in Section 3 & add diagram"
                  : "e.g. feature-async-streams"
              }
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Notebook selector when creating a Note */}
          {activeType === "note" && (
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Target Notebook</label>
              {notePermittedNotebooks.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-300 text-xs">
                  You must be an Owner or Maintainer of a notebook to create new notes in it.
                </div>
              ) : (
                <select
                  value={selectedNotebook}
                  onChange={(e) => setSelectedNotebook(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                >
                  {notePermittedNotebooks.map((nb) => (
                    <option key={nb.notebook_id} value={nb.notebook_id}>
                      {nb.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Cascading Notebook -> Note -> Block Selector when creating an Issue */}
          {activeType === "issue" && (
            <div className="space-y-3.5 p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <CircleDot className="w-3.5 h-3.5" />
                <span>Zero-Conflict Block Issue Target</span>
              </div>
              
              {/* 1. Choose Notebook */}
              <div>
                <label className="block text-amber-300 font-medium mb-1">1. Choose Notebook</label>
                {issuePermittedNotebooks.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-300 text-xs">
                    You do not hold Contributor, Maintainer, or Owner permissions on any notebook to create issues.
                  </div>
                ) : (
                  <select
                    value={issueNotebookId}
                    onChange={(e) => setIssueNotebookId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {issuePermittedNotebooks.map((nb) => (
                      <option key={nb.notebook_id} value={nb.notebook_id}>
                        {nb.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Choose Note */}
              <div>
                <label className="block text-amber-300 font-medium mb-1">2. Choose Note</label>
                {notesInSelectedNotebook.length === 0 ? (
                  <p className="text-zinc-500 italic p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                    {issueNotebookId ? 'No writable notes found in this notebook for your role.' : 'No notebook selected.'}
                  </p>
                ) : (
                  <select
                    value={issueNoteId}
                    onChange={(e) => setIssueNoteId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {notesInSelectedNotebook.map((note) => (
                      <option key={note.note_id} value={note.note_id}>
                        {note.title} ({note.blocks_count} blocks)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 3. Choose Block */}
              <div>
                <label className="block text-amber-300 font-medium mb-1">
                  3. Choose Target Block (Locks this block slot)
                </label>
                {isLoadingBlocks ? (
                  <div className="flex items-center gap-2 text-zinc-400 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-[11px]">
                    <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    Loading note blocks...
                  </div>
                ) : issueBlocks.length === 0 ? (
                  <p className="text-zinc-500 italic p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                    This note has no blocks yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={issueSlotId}
                      onChange={(e) => setIssueSlotId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono text-[11px]"
                    >
                      {issueBlocks.map((blk, idx) => {
                        const snippet = blk.content_text
                          ? blk.content_text.replace(/[\n\r]+/g, ' ').substring(0, 45)
                          : 'Empty block';
                        return (
                          <option key={blk.slot_id} value={blk.slot_id}>
                            Block #{idx + 1} [{blk.block_type}]: {snippet}...
                          </option>
                        );
                      })}
                    </select>

                    {/* Selected Block Preview */}
                    {(() => {
                      const selectedBlk = issueBlocks.find((b) => b.slot_id === issueSlotId);
                      if (!selectedBlk) return null;
                      return (
                        <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/90 text-zinc-400 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-amber-400/90">
                            <span>TYPE: {selectedBlk.block_type}</span>
                            <span>SLOT: {selectedBlk.slot_id.substring(0, 8)}...</span>
                          </div>
                          <p className="line-clamp-2 italic text-zinc-300">
                            "{selectedBlk.content_text || 'No text content'}"
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, goals, or summary..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Visibility options for Notebooks and Notes */}
          {(activeType === "notebook" || activeType === "note") && (
            <div>
              <label className="block text-zinc-300 font-semibold mb-1.5">Visibility</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility("PUBLIC")}
                  className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 cursor-pointer text-left transition-colors ${
                    visibility === "PUBLIC"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span className="font-semibold text-[11px]">Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("UNLISTED")}
                  className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 cursor-pointer text-left transition-colors ${
                    visibility === "UNLISTED"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span className="font-semibold text-[11px]">Unlisted</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("PRIVATE")}
                  className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 cursor-pointer text-left transition-colors ${
                    visibility === "PRIVATE"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span className="font-semibold text-[11px]">Private</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Create Resource
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 7. MAIN DASHBOARD CLIENT COMPONENT
// ==========================================

import { UserWithStats } from '@/actions/auth';
import { Notebook } from '@/actions/notebooks';

interface DashboardClientProps {
  user: UserWithStats;
  notebooks: Notebook[];
  unmergedBranches?: UnmergedBranchItem[];
  dashboardNotes?: DashboardNoteItem[];
  userRoles?: Array<{ notebook_id: string; role_type: string }>;
  analytics?: StorageAnalytics;
  activities?: ActivityItem[];
  starredItems?: StarredResourceItem[];
}

export default function DashboardClient({ 
  user, 
  notebooks,
  unmergedBranches = [],
  dashboardNotes = [],
  userRoles = [],
  analytics,
  activities = [],
  starredItems = [],
}: DashboardClientProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"notebook" | "note" | "issue" | "branch" | "fork">("note");
  const [isForkOpen, setIsForkOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenCreate = (type: "notebook" | "note" | "issue" | "branch" | "fork") => {
    if (type === "fork") {
      setIsForkOpen(true);
      return;
    }
    setCreateType(type);
    setIsCreateOpen(true);
  };

  const handleShowToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const firstNote = dashboardNotes[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. TOP NAVIGATION BAR */}
      <TopNav 
        userId={user.user_id} 
        currentUser={user} 
        onOpenCreate={handleOpenCreate} 
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900 border border-emerald-500/40 text-zinc-100 shadow-2xl shadow-emerald-950/40 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MAIN DASHBOARD BODY */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* LEFT: Profile & Notes/Notebooks Explorer */}
        <LeftSidebar
          user={user}
          notebooks={notebooks}
          dashboardNotes={dashboardNotes}
          userRoles={userRoles}
          starredItems={starredItems}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenCreate={handleOpenCreate}
        />

        {/* MIDDLE & RIGHT: Home Feed with VC Hub & Real Explorer */}
        <HomeFeed 
          user={user}
          notebooks={notebooks}
          unmergedBranches={unmergedBranches}
          dashboardNotes={dashboardNotes}
          userRoles={userRoles}
          analytics={analytics}
          activities={activities}
          starredItems={starredItems}
          onOpenCreate={handleOpenCreate} 
        />
      </div>

      {/* 3. MODALS */}
      <ProfileModal
        user={user}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <CreateModal
        isOpen={isCreateOpen}
        initialType={createType}
        notebooks={notebooks}
        dashboardNotes={dashboardNotes}
        userRoles={userRoles}
        userId={user.user_id}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleShowToast}
      />

      {/* Zero-Cost Fork Note Modal */}
      {firstNote && (
        <ForkNoteModal
          noteId={firstNote.note_id}
          noteTitle={firstNote.title}
          userId={user.user_id}
          userNotebooks={notebooks.map(nb => ({
            notebook_id: nb.notebook_id,
            title: nb.title,
            role_type: userRoles.find(r => r.notebook_id === nb.notebook_id)?.role_type || 'OWNER',
          }))}
          isOpen={isForkOpen}
          onClose={() => setIsForkOpen(false)}
        />
      )}
    </div>
  );
}
