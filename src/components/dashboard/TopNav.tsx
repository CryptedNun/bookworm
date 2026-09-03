"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  GitBranch,
  Search,
  CircleDot,
  GitPullRequest,
  BookMarked,
  Plus,
  ChevronDown,
  FileText,
  FolderPlus,
  GitFork,
  ShieldCheck,
  LogOut,
  Users,
} from "lucide-react";
import NotificationsDropdown from "@/components/notifications/NotificationsDropdown";
import RoleAuditorModal from "@/components/dashboard/RoleAuditorModal";
import CommandPalette from "@/components/dashboard/CommandPalette";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { useRouter } from "next/navigation";

interface TopNavProps {
  userId?: string;
  currentUser?: {
    user_id?: string;
    username?: string;
    email?: string;
    system_role?: string;
    avatar_url?: string | null;
  };
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
}

export function TopNav({ userId = "", currentUser, onOpenCreate }: TopNavProps) {
  const router = useRouter();
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Global Ctrl+K shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRoleSwitch = async (email: string) => {
    setIsSwitchingRole(true);
    try {
      const { signIn } = await import("@/actions/auth");
      await signIn(email, "password");
      setShowRoleMenu(false);
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Role switch error:", err);
      setIsSwitchingRole(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import("@/actions/auth");
      await signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/";
    }
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
            </button>

            <button
              onClick={() => onOpenCreate("branch")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 hover:text-zinc-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              <GitPullRequest className="w-3.5 h-3.5 text-blue-400" />
              <span>Branches</span>
            </button>

            <button
              onClick={() => onOpenCreate("notebook")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 hover:text-zinc-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              <BookMarked className="w-3.5 h-3.5 text-purple-400" />
              <span>Notebooks</span>
            </button>


          </nav>
        </div>

        {/* Center: Search Bar Triggering Command Palette */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div 
            onClick={() => setIsPaletteOpen(true)}
            className="relative cursor-pointer group"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-hover:text-emerald-400 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </div>
            <div className="w-full pl-9 pr-14 py-1.5 text-xs rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-400 group-hover:border-zinc-700 transition-all font-sans flex items-center select-none">
              <span>Search or jump to notes, notebooks, blocks...</span>
            </div>
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <kbd className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 group-hover:text-zinc-200 transition-colors">
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
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1.5 z-50 text-xs text-zinc-200 animate-popover-in">
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



          {/* Role Switcher Menu */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
              title="Switch authenticated user"
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-mono text-[11px] text-zinc-200">@{currentUser?.username || "alice"}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {showRoleMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1.5 z-50 text-xs text-zinc-200 divide-y divide-zinc-800/80 animate-popover-in">
                  <div className="px-3 py-2 text-[11px] text-zinc-400 space-y-0.5">
                    <div className="font-semibold text-zinc-200">Evaluation Role Switcher</div>
                    <div className="text-[10px] text-zinc-500">Test role-level capabilities from clean state</div>
                  </div>



                  <div className="py-1">
                    {[
                      { name: "Alice Walker", email: "alice@bookworm.dev", role: "OWNER / ADMIN", desc: "Full capabilities & delete permissions" },
                      { name: "Bob Chen", email: "bob@bookworm.dev", role: "MAINTAINER", desc: "Can merge, delete blocked (403)" },
                      { name: "Charlie Davis", email: "charlie@bookworm.dev", role: "CONTRIBUTOR", desc: "Draft edits only, merge blocked (403)" },
                      { name: "Diana Prince", email: "diana@bookworm.dev", role: "OUTSIDER", desc: "Private access blocked (403)" },
                    ].map((u) => (
                      <button
                        key={u.email}
                        onClick={() => handleRoleSwitch(u.email)}
                        disabled={isSwitchingRole}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-800/80 flex items-start justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-zinc-100 text-[11px]">{u.name}</div>
                          <div className="text-[10px] text-zinc-400">{u.desc}</div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-purple-300 border border-zinc-700 shrink-0">
                          {u.role.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="p-1.5 space-y-1">
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        setIsAuditorOpen(true);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg hover:bg-emerald-950/30 text-emerald-400 hover:text-emerald-300 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Run Evaluation Audit</span>
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500">CSE 216</span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-1.5 rounded-lg hover:bg-red-950/30 text-red-400 hover:text-red-300 flex items-center gap-2 text-xs transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Apple Light / Dark Mode Theme Toggle */}
          <ThemeToggle />

          {/* Notifications Dropdown */}
          <NotificationsDropdown userId={userId} />
        </div>
      </div>

      {/* Role Auditor Modal */}
      <RoleAuditorModal
        isOpen={isAuditorOpen}
        onClose={() => setIsAuditorOpen(false)}
        currentUser={currentUser}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenCreate={onOpenCreate}
      />
    </header>
  );
}

