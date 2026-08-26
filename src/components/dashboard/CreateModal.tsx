"use client";

import React, { useState } from "react";
import {
  X,
  FileText,
  FolderPlus,
  CircleDot,
  GitBranch,
  GitFork,
  Check,
  Lock,
  Globe,
  EyeOff,
} from "lucide-react";

interface CreateModalProps {
  isOpen: boolean;
  initialType: "notebook" | "note" | "issue" | "branch" | "fork";
  notebooks?: Array<{ notebook_id: string; title: string; }>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function CreateModal({ isOpen, initialType, notebooks = [], onClose, onSuccess }: CreateModalProps) {
  const [activeType, setActiveType] = useState<"notebook" | "note" | "issue" | "branch" | "fork">(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE" | "UNLISTED">("PUBLIC");
  const [selectedNotebook, setSelectedNotebook] = useState<string>("");
  const [targetSlot, setTargetSlot] = useState("Slot #42 (Paragraph: AVL double rotation)");
  const [assignee, setAssignee] = useState("@alice");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let msg = "";
    if (activeType === "notebook") msg = `Notebook "${title || "New Notebook"}" created successfully!`;
    if (activeType === "note") msg = `Note "${title || "New Note"}" created with initial main branch & commit!`;
    if (activeType === "issue") msg = `Issue "${title || "New Issue"}" created. Target block locked & branch spawned!`;
    if (activeType === "branch") msg = `Branch "${title || "feature-branch"}" spawned for parallel editing!`;
    if (activeType === "fork") msg = `Note forked with zero-cost CAS reference!`;
    
    onSuccess(msg);
    onClose();
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

          {/* Notebook Selector for Notes */}
          {activeType === "note" && (
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                Select Notebook
              </label>
              <select
                required
                value={selectedNotebook}
                onChange={(e) => setSelectedNotebook(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">Choose a notebook...</option>
                {notebooks.map((notebook) => (
                  <option key={notebook.notebook_id} value={notebook.notebook_id}>
                    {notebook.title}
                  </option>
                ))}
              </select>
              {notebooks.length === 0 && (
                <p className="mt-1 text-xs text-amber-400">
                  No notebooks available. Create a notebook first.
                </p>
              )}
            </div>
          )}

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
                <button
                  type="button"
                  onClick={() => setVisibility("UNLISTED")}
                  className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 cursor-pointer text-left transition-colors ${
                    visibility === "UNLISTED"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <EyeOff className="w-4 h-4" />
                  <span className="font-semibold text-[11px]">Unlisted</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Create Resource
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

