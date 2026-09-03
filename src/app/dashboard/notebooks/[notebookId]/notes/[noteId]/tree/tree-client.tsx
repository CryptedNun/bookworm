'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GitBranch,
  GitCommit,
  GitMerge,
  Clock,
  User as UserIcon,
  Eye,
  Filter,
  Code2,
  Copy,
  Check,
  Sparkles,
  Layers,
  X,
  FileText,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { BranchWithCommits } from '@/actions/branches';
import type { User as AuthUser } from '@/actions/auth';
import type { Note } from '@/actions/notes';
import { getCommitSnapshot } from '@/actions/branches';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';

interface TreeClientProps {
  note: Note;
  branches: BranchWithCommits[];
  notebookId: string;
  user: AuthUser;
}

interface CommitGraphNode {
  commit_id: string;
  commit_message: string;
  commit_hash: string;
  author_username: string;
  created_at: string;
  parent_commit_id: string | null;
  merge_parent_commit_id?: string | null;
  branch_id: string;
  branch_name: string;
  is_main: boolean;
  is_merged: boolean;
  lane: number;
  yIndex: number;
}

interface BlockSnapshotItem {
  slot_id: string;
  version_id: string;
  block_type: string;
  lexorank_key: string;
  content_text: string;
  sha256: string;
  created_at: string;
  author_username: string;
}

export default function TreeClient({ note, branches, notebookId, user }: TreeClientProps) {
  const [showAllBranches, setShowAllBranches] = useState(true);
  const [showMergedBranches, setShowMergedBranches] = useState(true);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');

  // Selected commit snapshot state
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotBlocks, setSnapshotBlocks] = useState<BlockSnapshotItem[]>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // 1. Process commits into an interactive DAG
  const { graphNodes, edges, lanesCount } = useMemo(() => {
    const branchMap = new Map<string, BranchWithCommits>();
    const allCommitsList: Array<any> = [];

    // Filter branches
    const filteredBranches = branches.filter((b) => {
      if (!showAllBranches && !b.is_main) return false;
      if (!showMergedBranches && b.is_merged) return false;
      return true;
    });

    // Assign lane 0 to main, and lane 1..N to other branches
    const branchLanes = new Map<string, number>();
    let nextLane = 1;

    // Main always lane 0
    const mainBranch = filteredBranches.find((b) => b.is_main);
    if (mainBranch) {
      branchLanes.set(mainBranch.branch_id, 0);
    }

    filteredBranches.forEach((b) => {
      if (!b.is_main) {
        branchLanes.set(b.branch_id, nextLane++);
      }
      branchMap.set(b.branch_id, b);
      (b.commits || []).forEach((c) => {
        allCommitsList.push({
          ...c,
          branch_id: b.branch_id,
          branch_name: b.branch_name,
          is_main: b.is_main,
          is_merged: b.is_merged,
          lane: branchLanes.get(b.branch_id) || 0,
        });
      });
    });

    // Sort chronologically (oldest at top y=0, newest at bottom, or reverse)
    // In Git graph, newest at top (y=0) is standard
    allCommitsList.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Deduplicate by commit_id
    const seenCommits = new Set<string>();
    const deduplicated: Array<any> = [];
    allCommitsList.forEach((c) => {
      if (!seenCommits.has(c.commit_id)) {
        seenCommits.add(c.commit_id);
        deduplicated.push(c);
      }
    });

    // Assign row indices
    const nodeMap = new Map<string, CommitGraphNode>();
    const nodes: CommitGraphNode[] = deduplicated.map((c, idx) => {
      const node: CommitGraphNode = {
        commit_id: c.commit_id,
        commit_message: c.commit_message,
        commit_hash: c.commit_hash || c.commit_id.replace(/-/g, '').substring(0, 12),
        author_username: c.author_username || 'contributor',
        created_at: c.created_at,
        parent_commit_id: c.parent_commit_id,
        merge_parent_commit_id: c.merge_parent_commit_id,
        branch_id: c.branch_id,
        branch_name: c.branch_name,
        is_main: c.is_main,
        is_merged: c.is_merged,
        lane: c.lane,
        yIndex: idx,
      };
      nodeMap.set(node.commit_id, node);
      return node;
    });

    // Build edges (connecting paths)
    interface Edge {
      fromId: string;
      toId: string;
      fromLane: number;
      fromY: number;
      toLane: number;
      toY: number;
      isMerge: boolean;
    }

    const calculatedEdges: Edge[] = [];
    nodes.forEach((node) => {
      // Direct parent edge
      if (node.parent_commit_id && nodeMap.has(node.parent_commit_id)) {
        const parent = nodeMap.get(node.parent_commit_id)!;
        calculatedEdges.push({
          fromId: node.commit_id,
          toId: parent.commit_id,
          fromLane: node.lane,
          fromY: node.yIndex,
          toLane: parent.lane,
          toY: parent.yIndex,
          isMerge: false,
        });
      }

      // Merge parent edge
      if (node.merge_parent_commit_id && nodeMap.has(node.merge_parent_commit_id)) {
        const mergeParent = nodeMap.get(node.merge_parent_commit_id)!;
        calculatedEdges.push({
          fromId: node.commit_id,
          toId: mergeParent.commit_id,
          fromLane: node.lane,
          fromY: node.yIndex,
          toLane: mergeParent.lane,
          toY: mergeParent.yIndex,
          isMerge: true,
        });
      }
    });

    return {
      graphNodes: nodes,
      edges: calculatedEdges,
      lanesCount: Math.max(1, nextLane),
    };
  }, [branches, showAllBranches, showMergedBranches]);

  // Set default selected commit on load
  useEffect(() => {
    if (!selectedCommitId && graphNodes.length > 0) {
      setSelectedCommitId(graphNodes[0].commit_id);
    }
  }, [graphNodes, selectedCommitId]);

  // Fetch block snapshot when selected commit changes
  useEffect(() => {
    if (!selectedCommitId) return;

    let isMounted = true;
    setSnapshotLoading(true);
    setSnapshotError(null);

    getCommitSnapshot(selectedCommitId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.blocks) {
          setSnapshotBlocks(res.blocks as BlockSnapshotItem[]);
        } else {
          setSnapshotError(res.error || 'Could not load commit blocks');
          setSnapshotBlocks([]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setSnapshotError(err.message || 'Failed to fetch blocks');
        setSnapshotBlocks([]);
      })
      .finally(() => {
        if (isMounted) setSnapshotLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCommitId]);

  const selectedNode = useMemo(
    () => graphNodes.find((n) => n.commit_id === selectedCommitId) || graphNodes[0],
    [graphNodes, selectedCommitId]
  );

  const handleCopyHash = (hash: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  // SVG dimensions
  const ROW_HEIGHT = 70;
  const LANE_WIDTH = 48;
  const LEFT_PADDING = 36;
  const TOP_PADDING = 40;
  const svgWidth = Math.max(260, LEFT_PADDING + lanesCount * LANE_WIDTH + 40);
  const svgHeight = TOP_PADDING + (graphNodes.length + 1) * ROW_HEIGHT;

  const getLaneColor = (lane: number, isMain: boolean) => {
    if (isMain || lane === 0) return { stroke: '#10b981', fill: '#059669', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    const palette = [
      { stroke: '#38bdf8', fill: '#0284c7', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
      { stroke: '#a855f7', fill: '#7e22ce', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      { stroke: '#f59e0b', fill: '#d97706', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      { stroke: '#ec4899', fill: '#db2777', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
      { stroke: '#14b8a6', fill: '#0d9488', bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
    ];
    return palette[(lane - 1) % palette.length];
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. Frosted Glass Top Navigation */}
      <header className="sticky top-0 z-40 w-full bg-zinc-950/80 backdrop-blur-2xl border-b border-white/[0.08] px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}`}
              className="p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
              title="Return to note"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <GitBranch className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-zinc-100 truncate">{note.title}</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Interactive Tree
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {graphNodes.length} commits across {branches.length} branches • Zero-conflict DAG
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-zinc-900/80 border border-white/[0.08] text-xs">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'graph'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                DAG Graph
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Log Timeline
              </button>
            </div>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/branches`}
              className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all"
            >
              Branches List
            </Link>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit`}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Body with Split View (Tree Visualizer on Left, Commit Block Inspector on Right) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / CENTER: Interactive Graph Visualization Canvas (7 cols on lg) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Filter & Zoom Bar */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                <span>Filters:</span>
              </span>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-400 hover:text-zinc-200">
                <input
                  type="checkbox"
                  checked={showAllBranches}
                  onChange={(e) => setShowAllBranches(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <span>All Branches</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-400 hover:text-zinc-200">
                <input
                  type="checkbox"
                  checked={showMergedBranches}
                  onChange={(e) => setShowMergedBranches(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <span>Merged</span>
              </label>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-zinc-950/60 border border-white/[0.08] rounded-xl p-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] text-zinc-400 px-1.5">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Interactive DAG Graph Area */}
          <div className="flex-1 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/[0.08] p-4 sm:p-6 overflow-x-auto min-h-[540px] relative shadow-xl">
            {graphNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center text-zinc-500 space-y-2">
                <GitCommit className="w-10 h-10 stroke-1 text-zinc-600" />
                <p className="text-sm">No commits found matching current filters.</p>
              </div>
            ) : (
              <div
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                className="transition-transform duration-150 flex items-start"
              >
                {/* SVG Curves & Circular Nodes */}
                <div className="relative shrink-0" style={{ width: svgWidth, height: svgHeight }}>
                  <svg width={svgWidth} height={svgHeight} className="absolute inset-0 pointer-events-none">
                    <defs>
                      <linearGradient id="mainGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>

                    {/* Background Lane Track Lines */}
                    {Array.from({ length: lanesCount }).map((_, laneIdx) => {
                      const x = LEFT_PADDING + laneIdx * LANE_WIDTH;
                      return (
                        <line
                          key={laneIdx}
                          x1={x}
                          y1={10}
                          x2={x}
                          y2={svgHeight - 10}
                          stroke={laneIdx === 0 ? '#10b981' : 'var(--lane-guide, #27272a)'}
                          strokeWidth={laneIdx === 0 ? '2' : '1'}
                          strokeDasharray={laneIdx === 0 ? undefined : '3,3'}
                          opacity={laneIdx === 0 ? 0.25 : 0.4}
                        />
                      );
                    })}

                    {/* Edge Connecting Curves */}
                    {edges.map((edge, idx) => {
                      const fromX = LEFT_PADDING + edge.fromLane * LANE_WIDTH;
                      const fromY = TOP_PADDING + edge.fromY * ROW_HEIGHT;
                      const toX = LEFT_PADDING + edge.toLane * LANE_WIDTH;
                      const toY = TOP_PADDING + edge.toY * ROW_HEIGHT;

                      const color = getLaneColor(edge.fromLane, edge.fromLane === 0);

                      if (fromX === toX) {
                        // Straight vertical line
                        return (
                          <line
                            key={idx}
                            x1={fromX}
                            y1={fromY}
                            x2={toX}
                            y2={toY}
                            stroke={color.stroke}
                            strokeWidth={edge.fromLane === 0 ? 3 : 2.5}
                            strokeOpacity={0.8}
                          />
                        );
                      }

                      // Smooth cubic Bezier curve across lanes
                      const midY = (fromY + toY) / 2;
                      const pathData = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

                      return (
                        <path
                          key={idx}
                          d={pathData}
                          fill="none"
                          stroke={edge.isMerge ? '#a855f7' : color.stroke}
                          strokeWidth={edge.isMerge ? 2.5 : 2}
                          strokeDasharray={edge.isMerge ? '4,3' : undefined}
                          strokeOpacity={0.85}
                        />
                      );
                    })}
                  </svg>

                  {/* Circular Interactive Nodes */}
                  {graphNodes.map((node) => {
                    const cx = LEFT_PADDING + node.lane * LANE_WIDTH;
                    const cy = TOP_PADDING + node.yIndex * ROW_HEIGHT;
                    const isSelected = node.commit_id === selectedCommitId;
                    const color = getLaneColor(node.lane, node.is_main);

                    return (
                      <div
                        key={node.commit_id}
                        style={{
                          left: `${cx}px`,
                          top: `${cy}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onClick={() => setSelectedCommitId(node.commit_id)}
                        className="absolute group cursor-pointer z-10"
                      >
                        {/* Selected Pulsing Halo */}
                        {isSelected && (
                          <div
                            className="absolute -inset-2.5 rounded-full animate-ping opacity-30 pointer-events-none"
                            style={{ backgroundColor: color.stroke }}
                          />
                        )}

                        {/* Circular Node Body */}
                        <div
                          style={{
                            borderColor: color.stroke,
                            boxShadow: isSelected
                              ? `0 0 16px ${color.stroke}88`
                              : '0 2px 8px rgba(0,0,0,0.5)',
                          }}
                          className={`w-7 h-7 rounded-full bg-zinc-950 border-2 flex items-center justify-center transition-all duration-200 group-hover:scale-125 ${
                            isSelected ? 'ring-2 ring-white/60 scale-110' : ''
                          }`}
                        >
                          {node.merge_parent_commit_id ? (
                            <GitMerge className="w-3 h-3 text-purple-400" />
                          ) : node.is_main ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          ) : (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: color.stroke }}
                            />
                          )}
                        </div>

                        {/* Hover Quick Label Tooltip */}
                        <div className="absolute left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 px-2 py-1 rounded-md bg-zinc-900/90 backdrop-blur-md border border-white/10 text-[10px] text-zinc-200 shadow-lg">
                          <div className="font-semibold">{node.commit_message}</div>
                          <div className="text-zinc-400 font-mono text-[9px]">
                            {node.commit_hash.substring(0, 8)} • @{node.author_username}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Commit Summary Labels beside the Graph */}
                <div className="flex-1 space-y-[22px] pt-[25px] pl-4">
                  {graphNodes.map((node) => {
                    const isSelected = node.commit_id === selectedCommitId;
                    const color = getLaneColor(node.lane, node.is_main);

                    return (
                      <div
                        key={node.commit_id}
                        onClick={() => setSelectedCommitId(node.commit_id)}
                        className={`h-12 px-3 py-1.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-zinc-850/90 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                            : 'bg-zinc-900/40 border-white/[0.05] hover:bg-zinc-850/50 hover:border-white/[0.12]'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-zinc-100 truncate">
                              {node.commit_message}
                            </span>
                            {node.merge_parent_commit_id && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                merge
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span className="font-mono text-emerald-400">@{node.author_username}</span>
                            <span>•</span>
                            <span className="font-mono text-zinc-400">{node.commit_hash.substring(0, 7)}</span>
                            <span>•</span>
                            <span className="truncate max-w-[140px] text-zinc-400">
                              {node.branch_name}
                            </span>
                          </div>
                        </div>

                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-zinc-600'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Live Commit Block Inspector (5 cols on lg) */}
        <aside className="lg:col-span-5 flex flex-col space-y-4">
          <div className="p-5 rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-5 sticky top-20">
            {/* Inspector Header */}
            <div className="border-b border-zinc-800/80 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>CAS Verified Commit</span>
                </span>

                <button
                  onClick={() => handleCopyHash(selectedNode?.commit_hash || '')}
                  className="px-2 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copy full commit SHA"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{selectedNode?.commit_hash?.substring(0, 8)}</span>
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-100 leading-snug">
                  {selectedNode?.commit_message}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Authored by <strong className="text-zinc-200">@{selectedNode?.author_username}</strong> on{' '}
                  {selectedNode?.created_at
                    ? new Date(selectedNode.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recent'}
                </p>
              </div>

              {/* Branch & Lineage Tags */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <div className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{selectedNode?.branch_name}</span>
                </div>

                {selectedNode?.parent_commit_id && (
                  <div className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-400">
                    parent: {selectedNode.parent_commit_id.replace(/-/g, '').substring(0, 7)}
                  </div>
                )}

                {selectedNode?.merge_parent_commit_id && (
                  <div className="px-2 py-0.5 rounded bg-purple-950/40 border border-purple-500/30 font-mono text-[10px] text-purple-300">
                    merged: {selectedNode.merge_parent_commit_id.replace(/-/g, '').substring(0, 7)}
                  </div>
                )}
              </div>
            </div>

            {/* Blocks Snapshot Title & Stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Document Blocks at This Commit
                </h4>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                {snapshotBlocks.length} blocks
              </span>
            </div>

            {/* Block List Container */}
            <div className="max-h-[440px] overflow-y-auto space-y-3 pr-1 divide-y divide-zinc-800/40">
              {snapshotLoading ? (
                <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <span>Reconstructing ternary manifests from CAS...</span>
                </div>
              ) : snapshotError ? (
                <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-xs">
                  {snapshotError}
                </div>
              ) : snapshotBlocks.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No block contents found for this commit snapshot.
                </div>
              ) : (
                snapshotBlocks.map((block, bIdx) => (
                  <div key={block.slot_id} className="pt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                        Block #{bIdx + 1} ({block.block_type})
                      </span>
                      <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[130px]">
                        sha256: {block.sha256.substring(0, 10)}...
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {block.content_text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
