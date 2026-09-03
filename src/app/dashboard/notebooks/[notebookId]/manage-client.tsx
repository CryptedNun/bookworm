'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  ArrowLeft, 
  Plus,
  GripVertical,
  FileText,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  X as XIcon,
  GitBranch,
  Users,
  Settings,
  Globe,
  Lock,
  Shield,
  Save,
} from 'lucide-react';
import { createNote, updateNoteOrder, deleteNote } from '@/actions/notes';
import { updateNotebook } from '@/actions/notebooks';
import type { Notebook } from '@/actions/notebooks';
import type { Note } from '@/actions/notes';
import PermissionsManager from '@/components/permissions/PermissionsManager';

interface Collaborator {
  role_id: string;
  user_id: string;
  role_type: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string; // ISO string from server
}

interface AccessRequest {
  request_id: string;
  user_id: string;
  requested_role: string;
  message?: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string; // ISO string from server
}

interface NotebookManageClientProps {
  notebook: Notebook;
  notes: Note[];
  userId: string;
  userRole?: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  collaborators: Collaborator[];
  accessRequests: AccessRequest[];
}

export default function NotebookManageClient({ 
  notebook, 
  notes: initialNotes, 
  userId,
  userRole = 'CONTRIBUTOR',
  collaborators,
  accessRequests,
}: NotebookManageClientProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'permissions' | 'settings'>('notes');
  const [notes, setNotes] = useState(initialNotes);
  const [draggedNote, setDraggedNote] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteDescription, setNewNoteDescription] = useState('');
  const [nbTitle, setNbTitle] = useState(notebook.title);
  const [nbDescription, setNbDescription] = useState(notebook.description || '');
  const [nbVisibility, setNbVisibility] = useState<'PUBLIC' | 'PRIVATE' | 'UNLISTED'>(notebook.visibility as any || 'PRIVATE');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canEdit = ['OWNER', 'MAINTAINER'].includes(notebook.role_type);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setIsSavingSettings(true);
    try {
      const res = await updateNotebook(notebook.notebook_id, {
        title: nbTitle.trim(),
        description: nbDescription.trim(),
        visibility: nbVisibility,
      }, userId);
      if (res.success) {
        showToast('Notebook settings and visibility updated');
      } else {
        showToast(res.error || 'Failed to update settings', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDragStart = (noteId: string) => {
    if (!canEdit) return;
    setDraggedNote(noteId);
  };

  const handleDragOver = (e: React.DragEvent, targetNoteId: string) => {
    e.preventDefault();
    if (!canEdit || !draggedNote || draggedNote === targetNoteId) return;

    // Reorder notes locally
    const draggedIndex = notes.findIndex(n => n.note_id === draggedNote);
    const targetIndex = notes.findIndex(n => n.note_id === targetNoteId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newNotes = [...notes];
    const [removed] = newNotes.splice(draggedIndex, 1);
    newNotes.splice(targetIndex, 0, removed);

    // Update display_order
    const updatedNotes = newNotes.map((note, index) => ({
      ...note,
      display_order: index + 1,
    }));

    setNotes(updatedNotes);
  };

  const handleDragEnd = async () => {
    if (!canEdit || !draggedNote) return;

    // Persist the new order to database
    const updatedNote = notes.find(n => n.note_id === draggedNote);
    if (updatedNote) {
      const result = await updateNoteOrder(draggedNote, updatedNote.display_order, userId);
      if (!result.success) {
        showToast('Failed to update note order', 'error');
        // Revert to initial state
        setNotes(initialNotes);
      } else {
        showToast('Note order updated successfully');
      }
    }

    setDraggedNote(null);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setIsSubmitting(true);

    try {
      const result = await createNote({
        title: newNoteTitle,
        description: newNoteDescription,
        notebookId: notebook.notebook_id,
        visibility: notebook.visibility,
        userId,
      });

      if (result.success) {
        showToast('Note created successfully!');
        setShowCreateModal(false);
        setNewNoteTitle('');
        setNewNoteDescription('');
        
        // Refresh the page to show new note
        window.location.reload();
      } else {
        showToast(result.error || 'Failed to create note', 'error');
      }
    } catch (error) {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!canEdit) return;
    
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    const result = await deleteNote(noteId, userId);
    if (result.success) {
      setNotes(notes.filter(n => n.note_id !== noteId));
      showToast('Note deleted successfully');
    } else {
      showToast(result.error || 'Failed to delete note', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-100">{notebook.title}</h1>
                <p className="text-xs text-zinc-400">
                  {notes.length} {notes.length === 1 ? 'note' : 'notes'} • {notebook.visibility}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Note
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs animate-in slide-in-from-bottom-3 duration-200 ${
          toast.type === 'success' 
            ? 'bg-zinc-900 border-emerald-500/40 text-zinc-100' 
            : 'bg-zinc-900 border-red-500/40 text-zinc-100'
        }`}>
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`} />
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Notebook Description */}
        {notebook.description && (
          <div className="mb-8 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <p className="text-sm text-zinc-300">{notebook.description}</p>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'notes'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-zinc-400 hover:text-zinc-300 border-transparent'
            }`}
          >
            <FileText className="w-4 h-4" />
            Notes ({notes.length})
          </button>
          
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'permissions'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-zinc-400 hover:text-zinc-300 border-transparent'
            }`}
          >
            <Users className="w-4 h-4" />
            Permissions ({collaborators.length})
            {accessRequests.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-zinc-950">
                {accessRequests.length}
              </span>
            )}
          </button>

          {canEdit && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === 'settings'
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-zinc-400 hover:text-zinc-300 border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings & Visibility
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                Notes in this Notebook
              </h2>
              {canEdit && (
                <p className="text-xs text-zinc-500">
                  Drag to reorder notes
                </p>
              )}
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 border-dashed">
                <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-400 mb-4">This notebook doesn't have any notes yet.</p>
                {canEdit && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first note
                  </button>
                )}
              </div>
            ) : (
              notes.map((note, index) => (
                <div
                  key={note.note_id}
                  draggable={canEdit}
                  onDragStart={() => handleDragStart(note.note_id)}
                  onDragOver={(e) => handleDragOver(e, note.note_id)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    draggedNote === note.note_id
                      ? 'bg-zinc-800 border-emerald-500/50 opacity-50'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  {canEdit && (
                    <button
                      className="cursor-grab active:cursor-grabbing p-1 text-zinc-600 hover:text-zinc-400"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="w-5 h-5" />
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-500">#{index + 1}</span>
                      <h3 className="text-sm font-semibold text-zinc-100 truncate">
                        {note.title}
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Updated {new Date(note.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/dashboard/notebooks/${notebook.notebook_id}/notes/${note.note_id}`}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      title="View note"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>

                    <Link
                      href={`/dashboard/notebooks/${notebook.notebook_id}/notes/${note.note_id}/tree`}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-blue-400 transition-colors"
                      title="View commit tree"
                    >
                      <GitBranch className="w-4 h-4" />
                    </Link>

                    {canEdit && (
                      <>
                        <Link
                          href={`/dashboard/notebooks/${notebook.notebook_id}/notes/${note.note_id}/edit`}
                          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                          title="Edit note"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>

                        <button
                          onClick={() => handleDeleteNote(note.note_id)}
                          className="p-2 rounded-lg bg-zinc-800 hover:bg-red-900 text-zinc-300 hover:text-red-400 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'permissions' && (
          <PermissionsManager
            resourceId={notebook.notebook_id}
            resourceType="NOTEBOOK"
            currentUserId={userId}
            currentUserRole={userRole}
            initialCollaborators={collaborators}
            initialAccessRequests={accessRequests}
          />
        )}

        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-6 max-w-2xl">
            <div>
              <h2 className="text-base font-bold text-zinc-100 mb-1">Notebook Settings</h2>
              <p className="text-xs text-zinc-400">Manage notebook title, description, and privacy visibility</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Notebook Title
                </label>
                <input
                  type="text"
                  required
                  value={nbTitle}
                  onChange={(e) => setNbTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={nbDescription}
                  onChange={(e) => setNbDescription(e.target.value)}
                  placeholder="What is this notebook collection about?"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Access & Visibility Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setNbVisibility('PUBLIC')}
                    className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer ${
                      nbVisibility === 'PUBLIC'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/40'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Public</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-tight">
                      Searchable on explore & open for all readers
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNbVisibility('UNLISTED')}
                    className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer ${
                      nbVisibility === 'UNLISTED'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/40'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Unlisted</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-tight">
                      Accessible via direct link, hidden from explore
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNbVisibility('PRIVATE')}
                    className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 text-left transition-all cursor-pointer ${
                      nbVisibility === 'PRIVATE'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/40'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Private</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-tight">
                      Strictly invite-only for you and your collaborators
                    </p>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Create Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <h3 className="text-sm font-bold text-zinc-100">Create New Note</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateNote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Note Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Introduction to React Hooks"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 text-sm disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newNoteDescription}
                  onChange={(e) => setNewNoteDescription(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Brief description of what this note covers..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none text-sm disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-all text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Note
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
