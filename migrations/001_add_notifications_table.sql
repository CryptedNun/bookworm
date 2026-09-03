-- Migration: Add notifications table
-- Purpose: Enable in-app notifications for access requests and collaboration events
-- Date: 2026-08-26

CREATE TABLE IF NOT EXISTS notifications (
    notification_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type   TEXT NOT NULL CHECK (notification_type IN (
        'ACCESS_REQUEST',
        'ACCESS_GRANTED', 
        'ACCESS_REJECTED',
        'COLLABORATOR_ADDED',
        'COLLABORATOR_REMOVED',
        'ROLE_UPDATED',
        'ISSUE_ASSIGNED',
        'BRANCH_MERGED',
        'COMMENT_ADDED'
    )),
    title               TEXT NOT NULL,
    message             TEXT NOT NULL,
    link                TEXT,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    related_resource_id UUID REFERENCES resources(resource_id) ON DELETE CASCADE,
    related_user_id     UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (notification_type);

-- Comments
COMMENT ON TABLE notifications IS 'In-app notifications for users about access requests, collaboration events, etc.';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification event';
COMMENT ON COLUMN notifications.link IS 'Optional URL to navigate to when clicking notification';
COMMENT ON COLUMN notifications.related_resource_id IS 'ID of related resource (notebook/note) if applicable';
COMMENT ON COLUMN notifications.related_user_id IS 'ID of user who triggered the notification';
