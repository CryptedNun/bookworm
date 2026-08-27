'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GitBranch,
  GitCommit,
  GitMerge,
  Clock,
  User,
  Eye,
  Filter,
  Maximize2,
  Code2,
} from 'lucide-react';
import type { BranchWithCommits } from '@/actions/branches';
import type { User as AuthUser } from '@/actions/auth';
import type { Note } from '@/actions/notes';

interface TreeClientProps {
  note: Note;
  branches: BranchWithCommits[];
  notebookId: string;
  user: AuthUser;
}

interface CommitNode {
  commit_id: string;
  commit_message: string;
  commit_hash: string;
  author_id: string;
  created_at: Date;
  parent_commit_id: string | null;
  branch_id: string;
  branch_name: string;
  is_main: boolean;
  is_merge: boolean;
  children: CommitNode[];
  column: number;
  row: number;
}

export default function TreeClient({ note, branches, notebookId, user }: TreeClientProps) {
  const [showAllBranches, setShowAllBranches] = useState(true);
  const [showMergedBranches, setShowMergedBranches] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  // Build commit tree structure
  const commitTree = useMemo(() => {
    // Collect all commits from all branches
    const allCommits = new Map<string, CommitNode>();
    
    branches.forEach(branch => {
      if (!showAllBranches && !branch.is_main) return;
      if (!showMergedBranches && branch.is_merged) return;

      branch.commits?.forEach(commit => {
        if (!allCommits.has(commit.commit_id)) {
          allCommits.set(commit.commit_id, {
            ...commit,
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            is_main: branch.is_main,
            is_merge: false, // Will be determined by children count
            children: [],
            column: 0,
            row: 0,
          });
        }
      });
    });

    // Build parent-child relationships
    const rootNodes: CommitNode[] = [];
    allCommits.forEach(node => {
      if (node.parent_commit_id) {
        const parent = allCommits.get(node.parent_commit_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not in filtered view, treat as root
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    // Mark merge commits (commits with multiple children)
    allCommits.forEach(node => {
      if (node.children.length > 1) {
        node.is_merge = true;
      }
    });

    // Calculate layout (column and row)
    let currentRow = 0;
    const assignedColumns = new Set<number>();
    
    const calculateLayout = (nodes: CommitNode[], column: number = 0) => {
      nodes.forEach(node => {
        node.row = currentRow++;
        node.column = column;
        
        if (node.children.length > 0) {
          // Assign children to columns
          node.children.forEach((child, index) => {
            const childColumn = index === 0 ? column : column + index;
            calculateLayout([child], childColumn);
          });
        }
      });
    };

    // Sort root nodes by creation date (newest first)
    const sortedRoots = rootNodes.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    calculateLayout(sortedRoots);

    return sortedRoots;
  }, [branches, showAllBranches, showMergedBranches]);

  // Flatten tree for rendering
  const flattenedCommits = useMemo(() => {
    const result: CommitNode[] = [];
    
    const traverse = (nodes: CommitNode[]) => {
      nodes.forEach(node => {
        result.push(node);
        if (node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    
    traverse(commitTree);
    return result.sort((a, b) => b.row - a.row);
  }, [commitTree]);

  const getBranchColor = (isMain: boolean, branchName: string) => {
    if (isMain) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    
    // Hash branch name to get consistent color
    const hash = branchName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'text-blue-400 bg-blue-500/10 border-blue-500/20',
      'text-purple-400 bg-purple-500/10 border-purple-500/20',
      'text-amber-400 bg-amber-500/10 border-amber-500/20',
      'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      'text-pink-400 bg-pink-500/10 border-pink-500/20',
    ];
    return colors[hash % colors.length];
  };

  const getConnectionColor = (isMain: boolean) => {
    return isMain ? 'border-emerald-500' : 'border-zinc-600';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/branches`}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-100">{note.title}</h1>
                <p className="text-xs text-zinc-400">
                  Commit History Tree • {flattenedCommits.length} commits across {branches.length} branches
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit`}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Code2 className="w-4 h-4" />
              Edit Note
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-300">Filters:</span>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllBranches}
              onChange={(e) => setShowAllBranches(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
            />
            <span className="text-sm text-zinc-300">Show all branches</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMergedBranches}
              onChange={(e) => setShowMergedBranches(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
            />
            <span className="text-sm text-zinc-300">Show merged branches</span>
          </label>

          <div className="ml-auto text-xs text-zinc-500">
            Showing {flattenedCommits.length} commits
          </div>
        </div>

        {/* Commit Tree Visualization */}
        <div className="space-y-0 bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 overflow-x-auto">
          {flattenedCommits.length === 0 ? (
            <div className="text-center py-12">
              <GitCommit className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No commits to display</p>
            </div>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {flattenedCommits.map((commit, index) => {
                const nextCommit = flattenedCommits[index + 1];
                const hasChildren = commit.children.length > 0;
                const isSelected = selectedCommit === commit.commit_id;

                return (
                  <div key={commit.commit_id} className="relative">
                    {/* Commit Line */}
                    <button
                      onClick={() => setSelectedCommit(isSelected ? null : commit.commit_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                        isSelected
                          ? 'bg-zinc-800 ring-2 ring-emerald-500/30'
                          : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      {/* Graph Column */}
                      <div className="flex items-center" style={{ minWidth: `${(commit.column + 1) * 40}px` }}>
                        {/* Spacing for columns */}
                        {Array.from({ length: commit.column }).map((_, i) => (
                          <div key={i} className="w-10 h-6 flex items-center justify-center">
                            <div className="w-px h-full bg-zinc-700" />
                          </div>
                        ))}
                        
                        {/* Commit node */}
                        <div className="relative flex items-center justify-center w-10">
                          {commit.is_merge ? (
                            <GitMerge className={`w-5 h-5 ${commit.is_main ? 'text-emerald-400' : 'text-blue-400'}`} />
                          ) : (
                            <GitCommit className={`w-5 h-5 ${commit.is_main ? 'text-emerald-400' : 'text-zinc-400'}`} />
                          )}
                        </div>
                      </div>

                      {/* Commit Info */}
                      <div className="flex-1 flex items-center gap-3 min-w-0 text-left">
                        <code className="text-zinc-500 shrink-0">
                          {commit.commit_hash.substring(0, 7)}
                        </code>
                        
                        <span className="text-zinc-200 truncate">
                          {commit.commit_message}
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${getBranchColor(commit.is_main, commit.branch_name)}`}>
                          {commit.branch_name}
                        </span>

                        <div className="flex items-center gap-2 text-zinc-500 shrink-0 ml-auto">
                          <Clock className="w-3 h-3" />
                          <span className="text-[11px]">
                            {new Date(commit.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* View Button */}
                      <div className="shrink-0">
                        <div className="p-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    </button>

                    {/* Connection Lines to Children */}
                    {hasChildren && (
                      <div className="relative ml-3" style={{ paddingLeft: `${commit.column * 40}px` }}>
                        {commit.children.map((child, childIndex) => {
                          const isLastChild = childIndex === commit.children.length - 1;
                          const childColumnOffset = (child.column - commit.column) * 40;
                          
                          return (
                            <div
                              key={child.commit_id}
                              className="absolute top-0 left-0 h-8"
                              style={{ 
                                marginLeft: `${20}px`,
                                width: childColumnOffset > 0 ? `${childColumnOffset + 20}px` : '20px'
                              }}
                            >
                              {/* Vertical line down */}
                              <div 
                                className={`absolute left-0 w-px h-4 ${getConnectionColor(commit.is_main)}`}
                              />
                              
                              {/* Horizontal line to child column if needed */}
                              {childColumnOffset > 0 && (
                                <>
                                  <div 
                                    className={`absolute left-0 top-4 h-px ${getConnectionColor(commit.is_main)}`}
                                    style={{ width: `${childColumnOffset}px` }}
                                  />
                                  <div 
                                    className={`absolute top-4 w-px h-4 ${getConnectionColor(child.is_main)}`}
                                    style={{ left: `${childColumnOffset}px` }}
                                  />
                                </>
                              )}
                              
                              {/* Vertical line to next commit if same column */}
                              {childColumnOffset === 0 && (
                                <div 
                                  className={`absolute left-0 top-4 w-px h-4 ${getConnectionColor(commit.is_main)}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Legend
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-300">Main branch commit</span>
            </div>
            <div className="flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-300">Feature branch commit</span>
            </div>
            <div className="flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-300">Merge commit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-px h-4 bg-emerald-500" />
              <span className="text-zinc-300">Branch connection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
