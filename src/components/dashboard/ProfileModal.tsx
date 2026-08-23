"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  User as UserIcon,
  Shield,
  Key,
  Database,
  LogOut,
  GitCommit,
  BookOpen,
  Folder,
  Layers,
} from "lucide-react";
import { currentUser } from "@/lib/mock-data";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "permissions" | "storage" | "keys">("profile");

  if (!isOpen) return null;

  const handleSignOut = () => {
    onClose();
    router.push("/");
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

