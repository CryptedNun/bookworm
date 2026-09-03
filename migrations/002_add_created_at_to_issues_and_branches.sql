-- Migration: Add created_at to issues and branches
-- Purpose: Support audit trail, ordering, and UI display for issues and branches
-- Date: 2026-09-03

ALTER TABLE issues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE branches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branches_created_at ON branches (created_at DESC);
