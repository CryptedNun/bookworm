'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/actions/notifications';

interface Notification {
  notification_id: string;
  notification_type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string | Date; // Accept both
}

interface NotificationsDropdownProps {
  userId: string;
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
}

export default function NotificationsDropdown({
  userId,
  initialNotifications = [],
  initialUnreadCount = 0,
}: NotificationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [notifResult, countResult] = await Promise.all([
        getUserNotifications(userId),
        getUnreadCount(userId),
      ]);

      if (notifResult.success) {
        setNotifications(notifResult.notifications as any);
      }
      if (countResult.success) {
        setUnreadCount(countResult.count);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationRead(notificationId, userId);
    if (result.success) {
      setNotifications(
        notifications.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsRead(userId);
    if (result.success) {
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleDelete = async (notificationId: string) => {
    const result = await deleteNotification(notificationId, userId);
    if (result.success) {
      const wasUnread = notifications.find((n) => n.notification_id === notificationId)?.is_read === false;
      setNotifications(notifications.filter((n) => n.notification_id !== notificationId));
      if (wasUnread) {
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    // Return appropriate icon based on notification type
    return <Bell className="w-4 h-4" />;
  };

  const formatTime = (date: Date | string) => {
    const now = new Date();
    const d = typeof date === 'string' ? new Date(date) : date;
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 text-zinc-950 text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-96 bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-zinc-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.notification_id}
                      className={`p-4 hover:bg-zinc-800/50 transition-colors ${
                        !notification.is_read ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={`p-2 rounded-lg ${
                            !notification.is_read
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {getNotificationIcon(notification.notification_type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-zinc-100">
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>

                          <p className="text-xs text-zinc-400 mb-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">
                              {formatTime(notification.created_at)}
                            </span>

                            <div className="flex items-center gap-2">
                              {notification.link && (
                                <Link
                                  href={notification.link}
                                  onClick={() => {
                                    handleMarkAsRead(notification.notification_id);
                                    setIsOpen(false);
                                  }}
                                  className="text-xs text-emerald-400 hover:text-emerald-300"
                                >
                                  View →
                                </Link>
                              )}

                              {!notification.is_read && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.notification_id)}
                                  className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400"
                                  title="Mark as read"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDelete(notification.notification_id)}
                                className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to notifications page if you have one
                  }}
                  className="w-full text-center text-xs text-zinc-400 hover:text-zinc-300"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
