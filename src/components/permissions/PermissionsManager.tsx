'use client';

import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Check, 
  X,
  Crown,
  Wrench,
  Edit,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  getPendingAccessRequests,
  reviewAccessRequest,
  getResourceCollaborators,
} from '@/actions/permissions';

interface Collaborator {
  role_id: string;
  user_id: string;
  role_type: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string | Date; // Accept both for flexibility
}

interface AccessRequest {
  request_id: string;
  user_id: string;
  requested_role: string;
  message?: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string | Date; // Accept both for flexibility
}

interface PermissionsManagerProps {
  resourceId: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  currentUserId: string;
  currentUserRole: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  initialCollaborators: Collaborator[];
  initialAccessRequests: AccessRequest[];
}

export default function PermissionsManager({
  resourceId,
  resourceType,
  currentUserId,
  currentUserRole,
  initialCollaborators,
  initialAccessRequests,
}: PermissionsManagerProps) {
  const [activeTab, setActiveTab] = useState<'collaborators' | 'requests'>('collaborators');
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [accessRequests, setAccessRequests] = useState(initialAccessRequests);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'MAINTAINER' | 'CONTRIBUTOR'>('CONTRIBUTOR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManageCollaborators = ['OWNER', 'MAINTAINER'].includes(currentUserRole);
  const canRemoveCollaborators = currentUserRole === 'OWNER';
  const canUpdateRoles = currentUserRole === 'OWNER';

  // Get role badge styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return {
          icon: <Crown className="w-3 h-3" />,
          className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
          label: 'Owner',
        };
      case 'MAINTAINER':
        return {
          icon: <Wrench className="w-3 h-3" />,
          className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          label: 'Maintainer',
        };
      case 'CONTRIBUTOR':
        return {
          icon: <Edit className="w-3 h-3" />,
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          label: 'Contributor',
        };
      default:
        return {
          icon: <Shield className="w-3 h-3" />,
          className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
          label: role,
        };
    }
  };

  // Add collaborator
  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await addCollaborator({
        resourceId,
        userEmail: addEmail,
        role: addRole,
        grantedBy: currentUserId,
      });

      if (result.success) {
        setSuccess(result.message || 'Collaborator added successfully');
        setAddEmail('');
        setShowAddForm(false);
        
        // Refresh collaborators list
        const updated = await getResourceCollaborators(resourceId, currentUserId);
        if (updated.success) {
          setCollaborators(updated.collaborators as any);
        }
      } else {
        setError(result.error || 'Failed to add collaborator');
      }
    } catch (err) {
      setError('An error occurred while adding collaborator');
    } finally {
      setLoading(false);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (targetUserId: string, username: string) => {
    if (!confirm(`Remove ${username} from this ${resourceType.toLowerCase()}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await removeCollaborator({
        resourceId,
        targetUserId,
        removedBy: currentUserId,
      });

      if (result.success) {
        setSuccess(result.message || 'Collaborator removed');
        setCollaborators(collaborators.filter(c => c.user_id !== targetUserId));
      } else {
        setError(result.error || 'Failed to remove collaborator');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Update role
  const handleUpdateRole = async (targetUserId: string, newRole: 'MAINTAINER' | 'CONTRIBUTOR') => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateCollaboratorRole({
        resourceId,
        targetUserId,
        newRole,
        updatedBy: currentUserId,
      });

      if (result.success) {
        setSuccess(result.message || 'Role updated');
        
        // Update local state
        setCollaborators(collaborators.map(c =>
          c.user_id === targetUserId
            ? { ...c, role_type: newRole }
            : c
        ));
      } else {
        setError(result.error || 'Failed to update role');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Review access request
  const handleReviewRequest = async (requestId: string, approve: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await reviewAccessRequest({
        requestId,
        approve,
        reviewerId: currentUserId,
      });

      if (result.success) {
        setSuccess(result.message || (approve ? 'Access granted' : 'Request rejected'));
        
        // Remove from pending list
        setAccessRequests(accessRequests.filter(r => r.request_id !== requestId));
        
        // If approved, refresh collaborators
        if (approve) {
          const updated = await getResourceCollaborators(resourceId, currentUserId);
          if (updated.success) {
            setCollaborators(updated.collaborators as any);
          }
        }
      } else {
        setError(result.error || 'Failed to process request');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manage Access
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Control who can access this {resourceType.toLowerCase()}
            </p>
          </div>

          {canManageCollaborators && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Collaborator
            </button>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Add Collaborator Form */}
        {showAddForm && (
          <form onSubmit={handleAddCollaborator} className="mt-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  User Email
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'MAINTAINER' | 'CONTRIBUTOR')}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CONTRIBUTOR">Contributor (can edit via issues)</option>
                  <option value="MAINTAINER">Maintainer (can edit directly, merge branches)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddEmail('');
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'collaborators'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          Collaborators ({collaborators.length})
        </button>
        {canManageCollaborators && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'requests'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Access Requests ({accessRequests.length})
            {accessRequests.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'collaborators' && (
          <div className="space-y-3">
            {collaborators.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No collaborators yet</p>
              </div>
            ) : (
              collaborators.map((collaborator) => {
                const badge = getRoleBadge(collaborator.role_type);
                const isCurrentUser = collaborator.user_id === currentUserId;
                const isOwner = collaborator.role_type === 'OWNER';

                return (
                  <div
                    key={collaborator.role_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800 border border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {collaborator.username[0].toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-100">
                            {collaborator.username}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-zinc-500">(you)</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-zinc-400">{collaborator.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Role Badge / Selector */}
                      {canUpdateRoles && !isOwner && !isCurrentUser ? (
                        <select
                          value={collaborator.role_type}
                          onChange={(e) =>
                            handleUpdateRole(
                              collaborator.user_id,
                              e.target.value as 'MAINTAINER' | 'CONTRIBUTOR'
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border text-xs font-medium bg-zinc-900 text-zinc-300 border-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="CONTRIBUTOR">Contributor</option>
                          <option value="MAINTAINER">Maintainer</option>
                        </select>
                      ) : (
                        <div
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${badge.className}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </div>
                      )}

                      {/* Remove Button */}
                      {canRemoveCollaborators && !isOwner && !isCurrentUser && (
                        <button
                          onClick={() => handleRemoveCollaborator(collaborator.user_id, collaborator.username)}
                          disabled={loading}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                          title="Remove collaborator"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {accessRequests.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No pending access requests</p>
              </div>
            ) : (
              accessRequests.map((request) => (
                <div
                  key={request.request_id}
                  className="p-4 rounded-lg bg-zinc-800 border border-zinc-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {request.username[0].toUpperCase()}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-zinc-100">
                            {request.username}
                          </p>
                          <span className="text-xs text-zinc-500">requested</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            getRoleBadge(request.requested_role).className
                          }`}>
                            {request.requested_role}
                          </span>
                          <span className="text-xs text-zinc-500">access</span>
                        </div>
                        
                        <p className="text-xs text-zinc-400 mb-2">{request.email}</p>

                        {request.message && (
                          <div className="p-2 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 mb-3">
                            "{request.message}"
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewRequest(request.request_id, true)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReviewRequest(request.request_id, false)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
