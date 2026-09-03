-- =====================================================================
-- BANGLADESH UNIVERSITY OF ENGINEERING AND TECHNOLOGY (BUET)
-- Department of Computer Science and Engineering
-- CSE 216 — Database Sessional Course Project
--
-- PROJECT: BookWorm — Git-like Version Control for Structured Notes
--
-- FILE: final_sql_schema.sql / rebuild_database.sql
-- PURPOSE: Master Database Schema & Production Warm-Up Dataset
--
-- HOW TO RENEW THE DATABASE:
-- Run in terminal:
--   psql "$DATABASE_URL" -f final_sql_schema.sql
-- Or copy-paste into Neon SQL Console / pgAdmin and run top-to-bottom.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. TEARDOWN (Clean Slate)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS issue_comments CASCADE;
DROP TABLE IF EXISTS user_starred_resources CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS access_requests CASCADE;
DROP TABLE IF EXISTS collaborator_roles CASCADE;
DROP TABLE IF EXISTS issue_contributors CASCADE;
DROP TABLE IF EXISTS commit_manifests CASCADE;
DROP TABLE IF EXISTS commits CASCADE;
DROP TABLE IF EXISTS editions CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS block_version_contents CASCADE;
DROP TABLE IF EXISTS logical_block_slots CASCADE;
DROP TABLE IF EXISTS content_blobs CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS notebooks CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS check_resource_is_notebook() CASCADE;
DROP FUNCTION IF EXISTS check_resource_is_note() CASCADE;
DROP FUNCTION IF EXISTS sync_issue_status_on_branch_merge() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- AREA 1 — USERS & PERMISSIONS
-- =====================================================================

CREATE TABLE users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL UNIQUE,
    avatar_url    TEXT,
    password_hash TEXT,
    salt          TEXT,
    system_role   VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (system_role IN ('ADMIN', 'USER')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ISA supertype for notebooks and notes
CREATE TABLE resources (
    resource_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   TEXT NOT NULL CHECK (resource_type IN ('NOTEBOOK', 'NOTE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_type ON resources (resource_type);

-- =====================================================================
-- AREA 2 — ORGANIZING CONTENT
-- =====================================================================

-- Shared-key ISA subtype: notebook_id IS resource_id
CREATE TABLE notebooks (
    notebook_id UUID PRIMARY KEY REFERENCES resources(resource_id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL REFERENCES users(user_id),
    title       TEXT NOT NULL,
    description TEXT,
    deleted_at  TIMESTAMPTZ,
    visibility  TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC'))
);

CREATE TABLE notes (
    note_id             UUID PRIMARY KEY REFERENCES resources(resource_id) ON DELETE CASCADE,
    notebook_id         UUID NOT NULL REFERENCES notebooks(notebook_id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    forked_from_note_id UUID REFERENCES notes(note_id) ON DELETE SET NULL,
    default_edition_id  UUID,
    display_order       INT NOT NULL DEFAULT 0,
    deleted_at          TIMESTAMPTZ,
    visibility          TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC'))
);

-- =====================================================================
-- AREA 3 — THE CONTENT ITSELF (3-Layer Architecture)
-- =====================================================================

-- Layer 3: Content-Addressed Storage (CAS)
CREATE TABLE content_blobs (
    sha256          CHAR(64) PRIMARY KEY,
    content_text    TEXT NOT NULL,
    byte_size       INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Layer 1: Structure (Where a block sits, independent of content)
CREATE TABLE logical_block_slots (
    slot_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    parent_slot_id  UUID REFERENCES logical_block_slots(slot_id) ON DELETE CASCADE,
    lexorank_key    TEXT NOT NULL,
    block_type      TEXT NOT NULL,
    UNIQUE (note_id, slot_id)
);

-- Layer 2: Versions (Who wrote what, for a given slot, and when)
CREATE TABLE block_version_contents (
    version_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id             UUID NOT NULL REFERENCES logical_block_slots(slot_id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES users(user_id),
    content_blob_hash   CHAR(64) NOT NULL REFERENCES content_blobs(sha256),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slot_id, version_id)
);

-- =====================================================================
-- AREA 4 — COLLABORATION & ISSUES
-- =====================================================================

CREATE TABLE issues (
    issue_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    target_slot_id  UUID NOT NULL,
    creator_id      UUID NOT NULL REFERENCES users(user_id),
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'MERGED', 'CLOSED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (note_id, target_slot_id) REFERENCES logical_block_slots (note_id, slot_id) ON DELETE CASCADE,
    UNIQUE (note_id, issue_id)
);

-- Active block locking: at most one active issue per slot
CREATE UNIQUE INDEX uq_one_active_issue_per_slot
    ON issues (target_slot_id)
    WHERE status IN ('OPEN', 'IN_PROGRESS');

-- =====================================================================
-- AREA 2 (cont'd) — BRANCHES
-- =====================================================================

CREATE TABLE branches (
    branch_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    issue_id        UUID,
    attempted_by    UUID REFERENCES users(user_id),
    branch_name     TEXT NOT NULL,
    is_main         BOOLEAN NOT NULL DEFAULT FALSE,
    is_merged       BOOLEAN NOT NULL DEFAULT FALSE,
    selected_by     UUID REFERENCES users(user_id),
    selected_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (note_id, issue_id) REFERENCES issues (note_id, issue_id) ON DELETE CASCADE,

    CONSTRAINT chk_main_xor_attempt CHECK (
        (is_main = TRUE  AND issue_id IS NULL     AND attempted_by IS NULL
                          AND is_merged = FALSE    AND selected_by IS NULL)
        OR
        (is_main = FALSE AND issue_id IS NOT NULL AND attempted_by IS NOT NULL)
    ),
    CONSTRAINT chk_selection_pair CHECK (
        (selected_by IS NULL) = (selected_at IS NULL)
    ),
    CONSTRAINT chk_merge_requires_selection CHECK (
        is_merged = (selected_by IS NOT NULL)
    )
);

-- At most one main branch per note
CREATE UNIQUE INDEX uq_one_main_branch_per_note
    ON branches (note_id)
    WHERE is_main = TRUE;

-- At most one winning merged branch per issue
CREATE UNIQUE INDEX uq_one_selected_branch_per_issue
    ON branches (issue_id)
    WHERE is_merged = TRUE;

-- =====================================================================
-- AREA 5 — VERSION CONTROL & COMMITS
-- =====================================================================

CREATE TABLE commits (
    commit_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           UUID NOT NULL REFERENCES branches(branch_id),
    parent_commit_id    UUID REFERENCES commits(commit_id),
    merge_parent_commit_id UUID REFERENCES commits(commit_id),
    author_id           UUID NOT NULL REFERENCES users(user_id),
    commit_message      TEXT,
    commit_hash         TEXT NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full manifest for each commit (Ternary fact: Commit × Slot × Version)
CREATE TABLE commit_manifests (
    manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commit_id   UUID NOT NULL REFERENCES commits(commit_id),
    slot_id     UUID NOT NULL,
    version_id  UUID NOT NULL,
    UNIQUE (commit_id, slot_id),
    FOREIGN KEY (slot_id, version_id) REFERENCES block_version_contents (slot_id, version_id)
);

-- =====================================================================
-- AREA 2 (cont'd) — EDITIONS (Snapshots)
-- =====================================================================

CREATE TABLE editions (
    edition_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id             UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    edition_name        TEXT NOT NULL,
    share_code          TEXT NOT NULL UNIQUE,
    pinned_commit_id    UUID NOT NULL REFERENCES commits(commit_id),
    is_standard         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by          UUID NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notes
    ADD CONSTRAINT fk_notes_default_edition
    FOREIGN KEY (default_edition_id) REFERENCES editions(edition_id) ON DELETE SET NULL;

-- =====================================================================
-- AREA 1 (cont'd) — ROLES & ACCESS CONTROL
-- =====================================================================

CREATE TABLE collaborator_roles (
    role_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id),
    resource_id     UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    role_type       TEXT NOT NULL CHECK (role_type IN ('OWNER', 'MAINTAINER', 'CONTRIBUTOR')),
    capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb,
    granted_by      UUID NOT NULL REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource_id)
);

CREATE TABLE access_requests (
    request_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id),
    initiated_by    UUID NOT NULL REFERENCES users(user_id),
    resource_id     UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    requested_role  TEXT NOT NULL CHECK (requested_role IN ('OWNER', 'MAINTAINER', 'CONTRIBUTOR')),
    direction       TEXT NOT NULL CHECK (direction IN ('REQUEST', 'INVITE')),
    status          TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by     UUID REFERENCES users(user_id),
    message         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ,

    CONSTRAINT chk_request_direction_consistency CHECK (
        (direction = 'REQUEST' AND initiated_by = user_id)
        OR
        (direction = 'INVITE'  AND initiated_by <> user_id)
    ),
    CONSTRAINT chk_review_matches_status CHECK (
        (status IN ('APPROVED', 'REJECTED')) = (reviewed_by IS NOT NULL)
    ),
    CONSTRAINT chk_reviewer_not_self_request CHECK (
        direction = 'INVITE' OR reviewed_by IS DISTINCT FROM user_id
    )
);

CREATE TABLE issue_contributors (
    issue_id        UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
    contributor_id  UUID NOT NULL REFERENCES users(user_id),
    assigned_by     UUID NOT NULL REFERENCES users(user_id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issue_id, contributor_id)
);

CREATE TABLE issue_comments (
    comment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id    UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

CREATE INDEX idx_issue_comments_issue_created ON issue_comments (issue_id, created_at ASC);

CREATE TABLE user_starred_resources (
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX idx_user_starred_user_created ON user_starred_resources (user_id, created_at DESC);

-- =====================================================================
-- AREA 6 — NOTIFICATIONS
-- =====================================================================

CREATE TABLE notifications (
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

-- =====================================================================
-- CONSISTENCY TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION check_resource_is_notebook() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM resources
        WHERE resource_id = NEW.notebook_id AND resource_type = 'NOTEBOOK'
    ) THEN
        RAISE EXCEPTION 'resources.resource_type must be NOTEBOOK for resource_id %', NEW.notebook_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notebooks_resource_type
    BEFORE INSERT ON notebooks
    FOR EACH ROW EXECUTE FUNCTION check_resource_is_notebook();

CREATE OR REPLACE FUNCTION check_resource_is_note() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM resources
        WHERE resource_id = NEW.note_id AND resource_type = 'NOTE'
    ) THEN
        RAISE EXCEPTION 'resources.resource_type must be NOTE for resource_id %', NEW.note_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notes_resource_type
    BEFORE INSERT ON notes
    FOR EACH ROW EXECUTE FUNCTION check_resource_is_note();

CREATE OR REPLACE FUNCTION sync_issue_status_on_branch_merge() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_merged = TRUE THEN
        UPDATE issues SET status = 'MERGED' WHERE issue_id = NEW.issue_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_branch_merge_updates_issue
    AFTER UPDATE OF is_merged ON branches
    FOR EACH ROW
    WHEN (NEW.is_merged IS DISTINCT FROM OLD.is_merged)
    EXECUTE FUNCTION sync_issue_status_on_branch_merge();

-- =====================================================================
-- LOOKUP INDEXES
-- =====================================================================

CREATE INDEX idx_notebooks_owner            ON notebooks (owner_id);
CREATE INDEX idx_notes_notebook              ON notes (notebook_id);
CREATE INDEX idx_notes_forked_from           ON notes (forked_from_note_id);
CREATE INDEX idx_notes_default_edition       ON notes (default_edition_id);

CREATE INDEX idx_slots_note                  ON logical_block_slots (note_id);
CREATE INDEX idx_slots_parent                ON logical_block_slots (parent_slot_id);

CREATE INDEX idx_versions_slot               ON block_version_contents (slot_id);
CREATE INDEX idx_versions_author             ON block_version_contents (author_id);
CREATE INDEX idx_versions_blob               ON block_version_contents (content_blob_hash);

CREATE INDEX idx_issues_note                 ON issues (note_id);
CREATE INDEX idx_issues_slot                 ON issues (target_slot_id);
CREATE INDEX idx_issues_creator              ON issues (creator_id);
CREATE INDEX idx_issues_created_at           ON issues (created_at DESC);

CREATE INDEX idx_branches_note               ON branches (note_id);
CREATE INDEX idx_branches_issue              ON branches (issue_id);
CREATE INDEX idx_branches_attempted_by       ON branches (attempted_by);
CREATE INDEX idx_branches_selected_by        ON branches (selected_by);
CREATE INDEX idx_branches_created_at         ON branches (created_at DESC);

CREATE INDEX idx_commits_branch              ON commits (branch_id);
CREATE INDEX idx_commits_parent              ON commits (parent_commit_id);
CREATE INDEX idx_commits_author              ON commits (author_id);

CREATE INDEX idx_manifests_commit            ON commit_manifests (commit_id);
CREATE INDEX idx_manifests_slot              ON commit_manifests (slot_id);
CREATE INDEX idx_manifests_version           ON commit_manifests (version_id);

CREATE INDEX idx_editions_note               ON editions (note_id);
CREATE INDEX idx_editions_pinned_commit      ON editions (pinned_commit_id);

CREATE INDEX idx_collab_roles_user           ON collaborator_roles (user_id);
CREATE INDEX idx_collab_roles_resource       ON collaborator_roles (resource_id);

CREATE INDEX idx_access_requests_user        ON access_requests (user_id);
CREATE INDEX idx_access_requests_resource    ON access_requests (resource_id);
CREATE INDEX idx_access_requests_reviewer    ON access_requests (reviewed_by);

CREATE INDEX idx_issue_contributors_user     ON issue_contributors (contributor_id);

CREATE INDEX idx_notifications_user          ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread        ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type          ON notifications (notification_type);

