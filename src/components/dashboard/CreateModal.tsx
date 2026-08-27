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
  Loader2,
} from "lucide-react";
import { createNotebook } from "@/actions/notebooks";
import { createNote } from "@/actions/notes";

interface CreateModalProps {
  isOpen: boolean;
  initialType: "notebook" | "note" | "issue" | "branch" | "fork";
  notebooks?: Array<{ notebook_id: string; title: string; }>;
  userId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function CreateModal({ isOpen, initialType, notebooks = [], userId, onClose, onSuccess }: CreateModalProps) {
  const [activeType, setActiveType] = useState<"notebook" | "note" | "issue" | "branch" | "fork">(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE" | "UNLISTED">("PUBLIC");
  const [selectedNotebook, setSelectedNotebook] = useState<string>("");
  const [targetSlot, setTargetSlot] = useState("Slot #42 (Paragraph: AVL double rotation)");
  const [assignee, setAssignee] = useState("@alice");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (activeType === "notebook") {
        const result = await createNotebook({
          title,
          description,
          visibility,
          userId,
        });

        if (result.success) {
          onSuccess(`Notebook "${title}" created successfully!`);
          onClose();
          // Reset form
          setTitle("");
          setDescription("");
          setVisibility("PUBLIC");
        } else {
          setError(result.error || "Failed to create notebook");
        }
      } else if (activeType === "note") {
        if (!selectedNotebook) {
          setError("Please select a notebook");
          setIsSubmitting(false);
          return;
        }

        const result = await createNote({
          title,
          description,
          visibility,
          notebookId: selectedNotebook,
          userId,
        });

        if (result.success) {
          onSuccess(`Note "${title}" created with initial main branch & commit!`);
          onClose();
          // Reset form
          setTitle("");
          setDescription("");
          setVisibility("PUBLIC");
          setSelectedNotebook("");
        } else {
          setError(result.error || "Failed to create note");
        }
      } else {
        // Placeholder for other types (issue, branch, fork)
        let msg = "";
        if (activeType === "issue") msg = `Issue "${title || "New Issue"}" created. Target block locked & branch spawned!`;
        if (activeType === "branch") msg = `Branch "${title || "feature-branch"}" spawned for parallel editing!`;
        if (activeType === "fork") msg = `Note forked with zero-cost CAS reference!`;
        
        onSuccess(msg);
        onClose();
      }
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
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
          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-xs">
              <p className="font-semibold">Error</p>
              <p className="text-[11px] mt-1">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              {activeType === "issue" ? "Issue Summary / Title" : "Title / Name"}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder={
                activeType === "notebook"
                  ? "e.g. Distributed Systems 2026"
                  : activeType === "note"
                  ? "e.g. Raft Consensus Protocol Explained"
                  : activeType === "issue"
                  ? "e.g. Fix typo in Section 3 & add diagram"
                  : "e.g. feature-async-streams"
              }
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
            />
          </div>

          {/* Notebook Selector for Notes */}
          {activeType === "note" && (
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                Select Notebook <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={selectedNotebook}
                onChange={(e) => setSelectedNotebook(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
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
              disabled={isSubmitting}
              placeholder="Provide context, goals, or summary..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none disabled:opacity-50"
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
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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

