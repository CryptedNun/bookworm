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
  Bell,
  Plus,
  ChevronDown,
  FileText,
  FolderPlus,
  GitFork,
  Check,
} from "lucide-react";
import { sampleNotifications, NotificationItem } from "@/lib/mock-data";

interface TopNavProps {
  onOpenCreate: (type: "notebook" | "note" | "issue" | "branch" | "fork") => void;
}

export function TopNav({ onOpenCreate }: TopNavProps) {
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

