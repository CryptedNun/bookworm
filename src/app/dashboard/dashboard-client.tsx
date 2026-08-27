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
} from "lucide-react";

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

// TODO: Remove this mock - temporary for child components
// Child components (TopNav, LeftSidebar, etc.) still reference this
// In Phase 2, we'll refactor to pass user data as props
export const currentUser: User = {
  id: 'usr-temp',
  name: 'Loading...',
  username: 'user',
  email: 'user@bookworm.dev',
  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  bio: '',
  role: 'OWNER',
  joinedDate: 'January 2026',
  capabilities: {
    canCreateIssue: true,
    canDeleteBranch: true,
    canMergeBranch: true,
    canAddContributor: true,
  },
  stats: {
    notebooksCount: 0,
    notesCount: 0,
    contributedCount: 0,
    issuesCount: 0,
    commitsCount: 0,
  },
};

export const sampleNotebooks: NotebookItem[] = [
  {
    id: 'nb-cs101',
    title: 'CS 101 Study Notes',
    description: 'Collaborative computer science fundamentals, algorithms, and data structures.',
    visibility: 'PUBLIC',
    role: 'OWNER',
    notesCount: 4,
    lastUpdated: '10m ago',
    isStarred: true,
    notes: [
      {
        id: 'note-trees',
        notebookId: 'nb-cs101',
        title: 'B-Trees and AVL Self-Balancing Trees',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v2.1 Final',
        lastUpdated: '10m ago',
        blocksCount: 48,
        branchesCount: 2,
        openIssuesCount: 1,
        isStarred: true,
      },
      {
        id: 'note-graphs',
        notebookId: 'nb-cs101',
        title: 'Graph Algorithms & Dijkstra Shortest Path',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v1.0 Stable',
        lastUpdated: '2h ago',
        blocksCount: 62,
        branchesCount: 1,
        openIssuesCount: 0,
      },
      {
        id: 'note-dp',
        notebookId: 'nb-cs101',
        title: 'Dynamic Programming & Memoization Patterns',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'Draft',
        lastUpdated: '1d ago',
        blocksCount: 34,
        branchesCount: 3,
        openIssuesCount: 2,
      },
    ],
  },
  {
    id: 'nb-web-arch',
    title: 'Modern Web Architecture',
    description: 'Next.js App Router, Server Components, and Database Optimization guides.',
    visibility: 'PUBLIC',
    role: 'OWNER',
    notesCount: 3,
    lastUpdated: '3h ago',
    isStarred: true,
    notes: [
      {
        id: 'note-next-rsc',
        notebookId: 'nb-web-arch',
        title: 'React 19 & Next.js Server Components In-Depth',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v3.0 Release',
        lastUpdated: '3h ago',
        blocksCount: 85,
        branchesCount: 2,
        openIssuesCount: 0,
        isStarred: true,
      },
      {
        id: 'note-lexorank',
        notebookId: 'nb-web-arch',
        title: 'LexoRank 3-Layer Block Storage Architecture',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v2.0 Pinned',
        lastUpdated: '5h ago',
        blocksCount: 110,
        branchesCount: 4,
        openIssuesCount: 1,
      },
    ],
  },
  {
    id: 'nb-db-design',
    title: 'Distributed Databases & Storage',
    description: 'Content-addressable storage (SHA-256), manifests, and deduplication models.',
    visibility: 'PRIVATE',
    role: 'OWNER',
    notesCount: 2,
    lastUpdated: '2d ago',
    notes: [
      {
        id: 'note-cas',
        notebookId: 'nb-db-design',
        title: 'Content-Addressed Blobs & Zero-Cost Forking',
        visibility: 'PRIVATE',
        role: 'OWNER',
        defaultEdition: 'Draft v1',
        lastUpdated: '2d ago',
        blocksCount: 42,
        branchesCount: 1,
        openIssuesCount: 0,
      },
    ],
  },
  {
    id: 'nb-research',
    title: 'Personal Research & Ideas',
    description: 'Draft ideas for decentralized knowledge graphs.',
    visibility: 'PRIVATE',
    role: 'OWNER',
    notesCount: 1,
    lastUpdated: '5d ago',
    notes: [
      {
        id: 'note-graphs-kg',
        notebookId: 'nb-research',
        title: 'Knowledge Graph Synapses',
        visibility: 'PRIVATE',
        role: 'OWNER',
        defaultEdition: 'v0.1',
        lastUpdated: '5d ago',
        blocksCount: 18,
        branchesCount: 1,
        openIssuesCount: 0,
      },
    ],
  },
];

export const sampleContributedNotes: NoteItem[] = [
  {
    id: 'note-os-internals',
    notebookId: 'nb-kernel-group',
    title: 'Linux Kernel Memory Management & Paging',
    description: 'Owned by @torvalds-club. Collaborative deep dive into Linux virtual memory.',
    visibility: 'PUBLIC',
    role: 'MAINTAINER',
    defaultEdition: 'v5.18 Stable',
    lastUpdated: '1h ago',
    blocksCount: 154,
    branchesCount: 5,
    openIssuesCount: 3,
    isStarred: true,
  },
  {
    id: 'note-postgres-tuning',
    notebookId: 'nb-db-perf',
    title: 'PostgreSQL Query Planner & Indexing Tactics',
    description: 'Owned by @db-guild. Production indexing patterns and VACUUM internals.',
    visibility: 'PUBLIC',
    role: 'CONTRIBUTOR',
    defaultEdition: 'v1.4',
    lastUpdated: '4h ago',
    blocksCount: 76,
    branchesCount: 2,
    openIssuesCount: 1,
  },
  {
    id: 'note-rust-async',
    notebookId: 'nb-rustaceans',
    title: 'Async Rust with Tokio: Concurrency Patterns',
    description: 'Owned by @rust-study. Pin, Futures, and Waker deep dive.',
    visibility: 'PUBLIC',
    role: 'CONTRIBUTOR',
    defaultEdition: 'v2.0 Draft',
    lastUpdated: '1d ago',
    blocksCount: 92,
    branchesCount: 3,
    openIssuesCount: 2,
  },
];

export const sampleNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'ACCESS_REQUEST',
    title: 'Access Request from @bob',
    description: 'Bob requested Contributor role on "CS 101 Study Notes"',
    timestamp: '15m ago',
    unread: true,
  },
  {
    id: 'notif-2',
    type: 'ISSUE_ASSIGNED',
    title: 'Assigned to Issue #21',
    description: 'Charlie assigned you to "Add TypeScript LexoRank midpoint code"',
    timestamp: '2h ago',
    unread: true,
  },
  {
    id: 'notif-3',
    type: 'BRANCH_MERGED',
    title: 'Branch Merged into main',
    description: 'Branch "issue-12-dijkstra-proof" was merged by @alice into main',
    timestamp: '1d ago',
    unread: false,
  },
  {
    id: 'notif-4',
    type: 'EDITION_PUBLISHED',
    title: 'New Edition Published',
    description: 'Edition "v3.0 Release" of React 19 Server Components is now live',
    timestamp: '2d ago',
    unread: false,
  },
];

// ==========================================
// 2. TOP NAV COMPONENT
// ==========================================

export function TopNav({
  onOpenCreate,
}: {
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(sampleNotifications);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-md px-4 lg:px-6 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Navigation Links */}
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-zinc-100 font-bold text-lg hover:opacity-90 transition-opacity tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <span>BookWorm</span>
          </Link>

          {/* GitHub-style Action Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-300">
            <button
              onClick={() => onOpenCreate("issue")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 hover:text-zinc-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
              <span>Issues</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-mono border border-emerald-500/20">
                3
              </span>
            </button>

            <button
              onClick={() => onOpenCreate("branch")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 hover:text-zinc-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              <GitPullRequest className="w-3.5 h-3.5 text-blue-400" />
              <span>Pull Requests & Merges</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-mono border border-blue-500/20">
                2
              </span>
            </button>

            <button
              onClick={() => onOpenCreate("notebook")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 hover:text-zinc-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              <BookMarked className="w-3.5 h-3.5 text-purple-400" />
              <span>Notebooks & Editions</span>
            </button>
          </nav>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or jump to notes, notebooks, issues, blocks..."
              className="w-full pl-9 pr-14 py-1.5 text-xs rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-sans"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <kbd className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                Ctrl K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Create & Notifications */}
        <div className="flex items-center gap-2 relative">
          {/* Quick Create (+) Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
              title="Create new item"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showPlusMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPlusMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1.5 z-50 text-xs text-zinc-200">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80">
                    Quick Actions
                  </div>

                  <button
                    onClick={() => {
                      setShowPlusMenu(false);
                      onOpenCreate("note");
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="font-medium">New Note</div>
                      <div className="text-[10px] text-zinc-500">Create modular 3-layer note</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowPlusMenu(false);
                      onOpenCreate("notebook");
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
                    <div>
                      <div className="font-medium">New Notebook</div>
                      <div className="text-[10px] text-zinc-500">Organize collections & permissions</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowPlusMenu(false);
                      onOpenCreate("issue");
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <CircleDot className="w-3.5 h-3.5 text-amber-400" />
                    <div>
                      <div className="font-medium">New Issue</div>
                      <div className="text-[10px] text-zinc-500">Lock block & assign contributor</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowPlusMenu(false);
                      onOpenCreate("branch");
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-blue-400" />
                    <div>
                      <div className="font-medium">New Branch</div>
                      <div className="text-[10px] text-zinc-500">Parallel editing workspace</div>
                    </div>
                  </button>

                  <div className="border-t border-zinc-800/80 my-1" />

                  <button
                    onClick={() => {
                      setShowPlusMenu(false);
                      onOpenCreate("fork");
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                    <div>
                      <div className="font-medium">Fork a Note</div>
                      <div className="text-[10px] text-zinc-500">Zero-cost content clone (CAS)</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-950/60 border-b border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-200">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs hover:bg-zinc-800/50 transition-colors ${
                          n.unread ? "bg-emerald-950/10" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-zinc-200">{n.title}</span>
                          <span className="text-[10px] text-zinc-500 shrink-0">{n.timestamp}</span>
                        </div>
                        <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">{n.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-2 text-center bg-zinc-950/60 border-t border-zinc-800">
                    <span className="text-[11px] text-zinc-500">All notifications updated</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ==========================================
// 3. LEFT SIDEBAR COMPONENT
// ==========================================

export function LeftSidebar({
  notebooks,
  onOpenProfile,
  onOpenCreate,
  onSelectNote,
}: {
  notebooks: Notebook[];
  onOpenProfile: () => void;
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
  onSelectNote?: (note: NoteItem) => void;
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "owned" | "contributed" | "starred">("all");
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({});

  const toggleNotebook = (id: string) => {
    setExpandedNotebooks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Transform real notebooks to match UI expectations
  const notebooksWithNotes = notebooks.map(nb => ({
    id: nb.notebook_id,
    title: nb.title,
    description: nb.description || '',
    visibility: nb.visibility,
    notesCount: nb.notes_count || 0,
    role: 'OWNER' as const, // TODO: Use actual role from database
    isStarred: false, // TODO: Implement starring
    notes: [] as Array<{
      id: string;
      title: string;
      openIssuesCount: number;
      defaultEdition: string;
    }>, // TODO: Fetch notes when expanded
  }));

  const filteredNotebooks = notebooksWithNotes.filter((nb) => {
    if (activeTab === "contributed") return false;
    if (activeTab === "starred" && !nb.isStarred) return false;
    if (!filterQuery) return true;
    const matchNb = nb.title.toLowerCase().includes(filterQuery.toLowerCase());
    return matchNb;
  });

  // TODO: Fetch contributed notes from database
  const filteredContributed: Array<{
    id: string;
    title: string;
    openIssuesCount: number;
    defaultEdition: string;
    [key: string]: any;
  }> = [];

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
                    {/* Notebook Header - Click to View */}
                    <Link
                      href={`/dashboard/notebooks/${nb.id}/manage`}
                      className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="w-3.5 h-3.5 text-purple-400 shrink-0" />
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
                          {nb.notesCount}
                        </span>
                        <ChevronRight className="w-3 h-3 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
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
                  onClick={() => {/* TODO: Implement note navigation */}}
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

// ==========================================
// 4. HOME FEED COMPONENT
// ==========================================

export function HomeFeed({
  onOpenCreate,
}: {
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
            <span>GitHub for Notes • Localhost Preview</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-extrabold text-zinc-100 tracking-tight">
            Welcome back, {currentUser.name}
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Manage your modular notes with Git-like branches, LexoRank block ordering, granular permissions, and content-addressed deduplication.
          </p>

          {/* Quick Action Buttons Directing to Functionalities */}
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
              onClick={() => onOpenCreate("branch")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="w-4 h-4 text-blue-400" />
              New Branch
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

      {/* 2. Core Architecture Stat Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Owned & Contributed</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">17 Notes</div>
          <p className="text-[11px] text-zinc-500">Across 4 notebooks</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Active Block Issues</span>
            <CircleDot className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">3 Open</div>
          <p className="text-[11px] text-zinc-500">Slot locks in effect</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Branch Merges</span>
            <GitPullRequest className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">14 Merged</div>
          <p className="text-[11px] text-zinc-500">Ternary manifests updated</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">CAS Deduplication</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">82.5%</div>
          <p className="text-[11px] text-zinc-500">Shared content blobs</p>
        </div>
      </div>

      {/* 3. Middle / Right Feed Placeholder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-200">Activity & Home Feed</h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Localhost Simulation</span>
        </div>

        {/* Minimalist Feed Placeholder State */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto shadow-inner">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-zinc-200">
              Home feed placeholder
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Global collaborative updates, note timeline commits, access invitations, and community forks will be rendered in this area as we continue building.
            </p>
          </div>

          {/* Demonstration list of recent collaborative events */}
          <div className="max-w-lg mx-auto text-left pt-4 divide-y divide-zinc-800/60 border-t border-zinc-800/60">
            <div className="py-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-zinc-200 font-medium">
                  <span className="text-emerald-400">@alice</span> published edition <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">v2.1 Final</code> of <span className="text-zinc-100 font-semibold">B-Trees and AVL Self-Balancing Trees</span>
                </p>
                <p className="text-[10px] text-zinc-500">10 minutes ago • Pinned to commit <span className="font-mono">#b7f92a</span></p>
              </div>
            </div>

            <div className="py-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <CircleDot className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-zinc-200 font-medium">
                  <span className="text-amber-400">@bob</span> opened Issue <span className="font-semibold">#14: Fix typo in AVL double rotation</span> targeting <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">Slot #42</code>
                </p>
                <p className="text-[10px] text-zinc-500">2 hours ago • Branch <span className="font-mono">issue-14-avl-rotation</span> created</p>
              </div>
            </div>

            <div className="py-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                <GitPullRequest className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-zinc-200 font-medium">
                  <span className="text-blue-400">@alice</span> merged branch <span className="font-mono text-zinc-300">issue-12-dijkstra-proof</span> into <span className="text-emerald-400 font-mono">main</span>
                </p>
                <p className="text-[10px] text-zinc-500">1 day ago • Manifest updated across 62 slots</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ==========================================
// 5. PROFILE MODAL COMPONENT
// ==========================================

export function ProfileModal({
  isOpen,
  onClose,
}: {
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
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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
            Overview
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
            CAS Deduplication
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
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-500/40"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-100">{currentUser.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">@{currentUser.username} • {currentUser.email}</p>
                  <p className="text-xs text-zinc-300 pt-1">{currentUser.bio}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <Folder className="w-3.5 h-3.5 text-purple-400" />
                    Notebooks
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{currentUser.stats.notebooksCount}</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Notes Owned
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{currentUser.stats.notesCount}</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Contributed
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{currentUser.stats.contributedCount}</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
                    <GitCommit className="w-3.5 h-3.5 text-amber-400" />
                    Commits
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">{currentUser.stats.commitsCount}</div>
                </div>
              </div>

              {/* Account Details Form */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Display Settings</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Display Name</label>
                    <input
                      type="text"
                      defaultValue={currentUser.name}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      defaultValue={currentUser.email}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500/50"
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
  userId,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  initialType: "notebook" | "note" | "issue" | "branch" | "fork";
  notebooks?: Array<{ notebook_id: string; title: string; }>;
  userId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [activeType, setActiveType] = useState<"notebook" | "note" | "issue" | "branch" | "fork">(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE");
  const [selectedNotebook, setSelectedNotebook] = useState<string>("");
  const [targetSlot, setTargetSlot] = useState("Slot #42 (Paragraph: AVL double rotation)");
  const [assignee, setAssignee] = useState("@alice");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    console.log('CreateModal: Form submitted', { activeType, title, description, visibility });
    setIsSubmitting(true);
    setError(null);

    try {
      if (activeType === "notebook") {
        console.log('CreateModal: Calling createNotebook...');
        const { createNotebook } = await import('@/actions/notebooks');
        const result = await createNotebook({
          title,
          description,
          visibility,
          userId,
        });

        console.log('CreateModal: Result received:', result);

        if (result.success) {
          console.log('CreateModal: Success! Showing toast.');
          onSuccess(`Notebook "${title}" created successfully!`);
          onClose();
        } else {
          console.error('CreateModal: Server returned error:', result.error);
          setError(result.error || 'Failed to create notebook');
        }
      } else if (activeType === "note") {
        console.log('CreateModal: Calling createNote...');
        const { createNote } = await import('@/actions/notes');
        const result = await createNote({
          notebookId: selectedNotebook,
          title,
          description,
          visibility,
          userId,
        });

        console.log('CreateModal: Note result:', result);

        if (result.success) {
          console.log('CreateModal: Note created successfully!');
          onSuccess(`Note "${title}" created successfully!`);
          onClose();
        } else {
          console.error('CreateModal: Server returned error:', result.error);
          setError(result.error || 'Failed to create note');
        }
      } else {
        // Other types not yet implemented
        let msg = "";
        if (activeType === "issue") msg = `Issue "${title}" created. Target block locked & branch spawned!`;
        if (activeType === "branch") msg = `Branch "${title}" spawned for parallel editing!`;
        if (activeType === "fork") msg = `Note forked with zero-cost CAS reference!`;
        
        onSuccess(msg);
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
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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

          {activeType === "issue" && (
            <div className="space-y-3 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20">
              <div>
                <label className="block text-amber-300 font-semibold mb-1">Target Logical Block Slot (Locked for this issue)</label>
                <input
                  type="text"
                  value={targetSlot}
                  onChange={(e) => setTargetSlot(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-amber-300 font-semibold mb-1">Assign Contributor</label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
                />
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
}

export default function DashboardClient({ user, notebooks }: DashboardClientProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"notebook" | "note" | "issue" | "branch" | "fork">("note");

  // Update the global currentUser object with real data
  // This is a temporary solution until we refactor child components to use props
  React.useEffect(() => {
    Object.assign(currentUser, {
      name: user.username,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatar_url || currentUser.avatarUrl,
      stats: {
        notebooksCount: user.stats.notebooks_count,
        notesCount: user.stats.notes_count,
        contributedCount: user.stats.contributed_count,
        issuesCount: user.stats.issues_count,
        commitsCount: user.stats.commits_count,
      },
    });
  }, [user]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenCreate = (type: "notebook" | "note" | "issue" | "branch" | "fork") => {
    setCreateType(type);
    setIsCreateOpen(true);
  };

  const handleShowToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. TOP NAVIGATION BAR */}
      <TopNav onOpenCreate={handleOpenCreate} />

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
          notebooks={notebooks}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenCreate={handleOpenCreate}
        />

        {/* MIDDLE & RIGHT: Home Feed Placeholder */}
        <HomeFeed onOpenCreate={handleOpenCreate} />
      </div>

      {/* 3. MODALS */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <CreateModal
        isOpen={isCreateOpen}
        initialType={createType}
        notebooks={notebooks}
        userId={user.user_id}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleShowToast}
      />
    </div>
  );
}
