-- =====================================================================
-- MIGRATION 003: Add Issue Comments & Starred Resources
-- BookWorm Database Schema Extension
-- =====================================================================

-- 1. Issue Discussion & Review Comments
CREATE TABLE IF NOT EXISTS issue_comments (
    comment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id    UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_created 
    ON issue_comments (issue_id, created_at ASC);

-- 2. Starred Resources (Notebooks & Notes Bookmarking)
CREATE TABLE IF NOT EXISTS user_starred_resources (
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_user_starred_user_created
    ON user_starred_resources (user_id, created_at DESC);
