-- =====================================================================
-- BookWorm — Complete Database Schema & High-Quality Seed Data
-- PostgreSQL / Neon auditted schema + production-grade demo dataset
-- Run top-to-bottom to recreate and seed the entire database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. TEARDOWN (Clean Slate)
-- ---------------------------------------------------------------------
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


-- =====================================================================
-- HIGH-QUALITY DEMO SEED DATA
-- =====================================================================

-- 1. USERS
INSERT INTO users (user_id, email, username, avatar_url, is_active, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@bookworm.dev', 'alice', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', TRUE, '2026-01-10 09:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@bookworm.dev', 'bob', 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&auto=format&fit=crop&q=80', TRUE, '2026-01-12 14:30:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@bookworm.dev', 'charlie', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', TRUE, '2026-01-15 11:15:00+00'),
  ('550e8400-e29b-41d4-a716-446655440004', 'diana@bookworm.dev', 'diana', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', TRUE, '2026-01-18 16:45:00+00');

-- 2. NOTEBOOKS
-- Notebook 1: CS 101 Study Notes (Alice, Public)
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'NOTEBOOK', '2026-01-11 10:00:00+00');
INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'CS 101 Study Notes', 'Collaborative computer science fundamentals, self-balancing search trees, graph algorithms, and dynamic programming.', 'PUBLIC');
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-11 10:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-13 12:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-16 15:00:00+00');

-- Notebook 2: Modern Web Architecture (Alice, Public)
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('650e8400-e29b-41d4-a716-446655440002', 'NOTEBOOK', '2026-01-14 11:00:00+00');
INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility) VALUES
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Modern Web Architecture', 'Next.js 15 App Router, React Server Actions, zero-bundle abstractions, and distributed edge computing.', 'PUBLIC');
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-14 11:00:00+00');

-- Notebook 3: Database Internals (Bob, Public)
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('650e8400-e29b-41d4-a716-446655440003', 'NOTEBOOK', '2026-01-15 14:00:00+00');
INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility) VALUES
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Database Internals & Storage Engines', 'Deep dive into Write-Ahead Logging (WAL), ARIES recovery protocol, MVCC vacuuming, and buffer pool eviction.', 'PUBLIC');
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440003', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-15 14:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-17 10:00:00+00');


-- 3. NOTES IN NOTEBOOK 1 (CS 101)

-- Note 1.1: B-Trees and AVL Trees
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'NOTE', '2026-01-11 10:30:00+00');
INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'B-Trees & Page-Structured Storage', 'PUBLIC', 0);
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-11 10:30:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-13 12:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-16 15:00:00+00');

-- Main branch for Note 1.1
INSERT INTO branches (branch_id, note_id, branch_name, is_main, is_merged, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'main', TRUE, FALSE, '2026-01-11 10:30:00+00');

-- 4 Logical Block Slots for Note 1.1
INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001', '1|400000', 'QUOTE');

-- Content Blobs (CAS)
INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('B-Trees & Page-Structured Storage Engines', 'sha256'), 'hex'), 
   'B-Trees & Page-Structured Storage Engines', 
   octet_length('B-Trees & Page-Structured Storage Engines')),

  (encode(digest('B-Trees generalize binary search trees by allowing nodes with more than two children. Unlike self-balancing binary search trees (AVL or Red-Black), B-Trees are optimized for systems that read and write large blocks of memory, minimizing expensive disk I/O operations.', 'sha256'), 'hex'),
   'B-Trees generalize binary search trees by allowing nodes with more than two children. Unlike self-balancing binary search trees (AVL or Red-Black), B-Trees are optimized for systems that read and write large blocks of memory, minimizing expensive disk I/O operations.',
   octet_length('B-Trees generalize binary search trees by allowing nodes with more than two children. Unlike self-balancing binary search trees (AVL or Red-Black), B-Trees are optimized for systems that read and write large blocks of memory, minimizing expensive disk I/O operations.')),

  (encode(digest('// B-Tree Node Structure in TypeScript
interface BTreeNode<K, V> {
  isLeaf: boolean;
  keys: K[];
  values: V[];
  children?: BTreeNode<K, V>[];
  maxDegree: number; // Order M of tree
}', 'sha256'), 'hex'),
   '// B-Tree Node Structure in TypeScript
interface BTreeNode<K, V> {
  isLeaf: boolean;
  keys: K[];
  values: V[];
  children?: BTreeNode<K, V>[];
  maxDegree: number; // Order M of tree
}',
   octet_length('// B-Tree Node Structure in TypeScript
interface BTreeNode<K, V> {
  isLeaf: boolean;
  keys: K[];
  values: V[];
  children?: BTreeNode<K, V>[];
  maxDegree: number; // Order M of tree
}')),

  (encode(digest('Design Rule: A B-Tree of order M guarantees that every non-leaf node has at least ceil(M/2) children, bounding tree height to O(log_M(N)).', 'sha256'), 'hex'),
   'Design Rule: A B-Tree of order M guarantees that every non-leaf node has at least ceil(M/2) children, bounding tree height to O(log_M(N)).',
   octet_length('Design Rule: A B-Tree of order M guarantees that every non-leaf node has at least ceil(M/2) children, bounding tree height to O(log_M(N)).'));

-- Block Version Contents
INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash, created_at) VALUES
  ('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', encode(digest('B-Trees & Page-Structured Storage Engines', 'sha256'), 'hex'), '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440002', '950e840production-grade demo dataset
-- Run top-to-bottom to recreate and seed the entire database.0-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', encode(digest('B-Trees generalize binary search trees by allowing nodes with more than two children. Unlike self-balancing binary search trees (AVL or Red-Black), B-Trees are optimized for systems that read and write large blocks of memory, minimizing expensive disk I/O operations.', 'sha256'), 'hex'), '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', encode(digest('// B-Tree Node Structure in TypeScript
interface BTreeNode<K, V> {
  isLeaf: boolean;
  keys: K[];
  values: V[];
  children?: BTreeNode<K, V>[];
  maxDegree: number; // Order M of tree
}', 'sha256'), 'hex'), '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', encode(digest('Design Rule: A B-Tree of order M guarantees that every non-leaf node has at least ceil(M/2) children, bounding tree height to O(log_M(N)).', 'sha256'), 'hex'), '2026-01-11 10:30:00+00');

-- Commit 1 on Note 1.1 main branch
INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial draft: B-Tree definitions and TypeScript types', encode(digest('commit-1-note-1', 'sha256'), 'hex'), '2026-01-11 10:35:00+00');

-- Manifest for Commit 1 (all 4 blocks)
INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001'),
  ('b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002'),
  ('b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440003'),
  ('b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440004');

-- Edition 1 on Note 1.1
INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by) VALUES
  ('c50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'v1.0 Standard Edition', 'btree-101', 'b50e8400-e29b-41d4-a716-446655440001', TRUE, '550e8400-e29b-41d4-a716-446655440001');

UPDATE notes SET default_edition_id = 'c50e8400-e29b-41d4-a716-446655440001' WHERE note_id = '750e8400-e29b-41d4-a716-446655440001';


-- Note 1.2: Graph Algorithms & Dijkstra's Shortest Path
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('750e8400-e29b-41d4-a716-446655440002', 'NOTE', '2026-01-12 14:00:00+00');
INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'Graph Algorithms & Dijkstra Shortest Path', 'PUBLIC', 1);
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-12 14:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-13 12:00:00+00');

INSERT INTO branches (branch_id, note_id, branch_name, is_main, is_merged, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'main', TRUE, FALSE, '2026-01-12 14:00:00+00');

INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440002', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440002', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-446655440002', '1|300000', 'CODE');

INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('Single-Source Shortest Paths: Dijkstra Algorithm', 'sha256'), 'hex'), 
   'Single-Source Shortest Paths: Dijkstra Algorithm', 
   octet_length('Single-Source Shortest Paths: Dijkstra Algorithm')),

  (encode(digest('Dijkstra algorithm computes shortest paths from a single source vertex to all other vertices in a weighted, directed graph with non-negative edge weights. Using a Fibonacci or Binary Min-Heap priority queue, time complexity is O((|V| + |E|) log |V|).', 'sha256'), 'hex'),
   'Dijkstra algorithm computes shortest paths from a single source vertex to all other vertices in a weighted, directed graph with non-negative edge weights. Using a Fibonacci or Binary Min-Heap priority queue, time complexity is O((|V| + |E|) log |V|).',
   octet_length('Dijkstra algorithm computes shortest paths from a single source vertex to all other vertices in a weighted, directed graph with non-negative edge weights. Using a Fibonacci or Binary Min-Heap priority queue, time complexity is O((|V| + |E|) log |V|).')),

  (encode(digest('function dijkstra(graph: Map<string, Array<{to: string, weight: number}>>, start: string): Map<string, number> {
  const distances = new Map<string, number>();
  const pq = new PriorityQueue<string>();
  distances.set(start, 0);
  pq.enqueue(start, 0);
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    for (const edge of graph.get(current) || []) {
      const alt = distances.get(current)! + edge.weight;
      if (alt < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, alt);
        pq.enqueue(edge.to, alt);
      }
    }
  }
  return distances;
}', 'sha256'), 'hex'),
   'function dijkstra(graph: Map<string, Array<{to: string, weight: number}>>, start: string): Map<string, number> {
  const distances = new Map<string, number>();
  const pq = new PriorityQueue<string>();
  distances.set(start, 0);
  pq.enqueue(start, 0);
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    for (const edge of graph.get(current) || []) {
      const alt = distances.get(current)! + edge.weight;
      if (alt < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, alt);
        pq.enqueue(edge.to, alt);
      }
    }
  }
  return distances;
}',
   octet_length('function dijkstra(graph: Map<string, Array<{to: string, weight: number}>>, start: string): Map<string, number> {
  const distances = new Map<string, number>();
  const pq = new PriorityQueue<string>();
  distances.set(start, 0);
  pq.enqueue(start, 0);
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    for (const edge of graph.get(current) || []) {
      const alt = distances.get(current)! + edge.weight;
      if (alt < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, alt);
        pq.enqueue(edge.to, alt);
      }
    }
  }
  return distances;
}'));

INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash, created_at) VALUES
  ('a50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', encode(digest('Single-Source Shortest Paths: Dijkstra Algorithm', 'sha256'), 'hex'), '2026-01-12 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', encode(digest('Dijkstra algorithm computes shortest paths from a single source vertex to all other vertices in a weighted, directed graph with non-negative edge weights. Using a Fibonacci or Binary Min-Heap priority queue, time complexity is O((|V| + |E|) log |V|).', 'sha256'), 'hex'), '2026-01-12 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', encode(digest('function dijkstra(graph: Map<string, Array<{to: string, weight: number}>>, start: string): Map<string, number> {
  const distances = new Map<string, number>();
  const pq = new PriorityQueue<string>();
  distances.set(start, 0);
  pq.enqueue(start, 0);
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    for (const edge of graph.get(current) || []) {
      const alt = distances.get(current)! + edge.weight;
      if (alt < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, alt);
        pq.enqueue(edge.to, alt);
      }
    }
  }
  return distances;
}', 'sha256'), 'hex'), '2026-01-12 14:00:00+00');

INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440002', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial commit: Dijkstra implementation in TypeScript', encode(digest('commit-1-note-2', 'sha256'), 'hex'), '2026-01-12 14:05:00+00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440005', 'a50e8400-e29b-41d4-a716-446655440005'),
  ('b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440006', 'a50e8400-e29b-41d4-a716-446655440006'),
  ('b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440007', 'a50e8400-e29b-41d4-a716-446655440007');

INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by) VALUES
  ('c50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'v1.0 Release', 'dijkstra-v1', 'b50e8400-e29b-41d4-a716-446655440002', TRUE, '550e8400-e29b-41d4-a716-446655440001');

UPDATE notes SET default_edition_id = 'c50e8400-e29b-41d4-a716-446655440002' WHERE note_id = '750e8400-e29b-41d4-a716-446655440002';


-- 3. NOTES IN NOTEBOOK 2 (Modern Web Architecture)

-- Note 2.1: Next.js 15 Server Actions
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('750e8400-e29b-41d4-a716-446655440003', 'NOTE', '2026-01-14 11:30:00+00');
INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440002', 'Next.js 15 Server Actions & Zero-Bundle Architecture', 'PUBLIC', 0);
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440003', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-14 11:30:00+00');

INSERT INTO branches (branch_id, note_id, branch_name, is_main, is_merged, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440003', 'main', TRUE, FALSE, '2026-01-14 11:30:00+00');

INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440008', '750e8400-e29b-41d4-a716-446655440003', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440009', '750e8400-e29b-41d4-a716-446655440003', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440010', '750e8400-e29b-41d4-a716-446655440003', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440011', '750e8400-e29b-41d4-a716-446655440003', '1|400000', 'QUOTE');

INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('Next.js 15 Server Actions & Zero-Bundle Architecture', 'sha256'), 'hex'), 
   'Next.js 15 Server Actions & Zero-Bundle Architecture', 
   octet_length('Next.js 15 Server Actions & Zero-Bundle Architecture')),

  (encode(digest('Server Actions in Next.js 15 execute entirely on the server runtime. By co-locating mutations with server components, client bundles remain lightweight with zero client JavaScript emitted for server-only logic.', 'sha256'), 'hex'),
   'Server Actions in Next.js 15 execute entirely on the server runtime. By co-locating mutations with server components, client bundles remain lightweight with zero client JavaScript emitted for server-only logic.',
   octet_length('Server Actions in Next.js 15 execute entirely on the server runtime. By co-locating mutations with server components, client bundles remain lightweight with zero client JavaScript emitted for server-only logic.')),

  (encode(digest('''use server'';

import { revalidatePath } from ''next/cache'';
import { sql } from ''@/lib/db'';

export async function createCommit(branchId: string, message: string) {
  const [commit] = await sql`
    INSERT INTO commits (branch_id, commit_message, commit_hash, author_id)
    VALUES (${branchId}, ${message}, gen_random_uuid()::text, ${userId})
    RETURNING commit_id
  `;
  revalidatePath(''/dashboard'');
  return { success: true, commitId: commit.commit_id };
}', 'sha256'), 'hex'),
   '''use server'';

import { revalidatePath } from ''next/cache'';
import { sql } from ''@/lib/db'';

export async function createCommit(branchId: string, message: string) {
  const [commit] = await sql`
    INSERT INTO commits (branch_id, commit_message, commit_hash, author_id)
    VALUES (${branchId}, ${message}, gen_random_uuid()::text, ${userId})
    RETURNING commit_id
  `;
  revalidatePath(''/dashboard'');
  return { success: true, commitId: commit.commit_id };
}',
   octet_length('''use server'';

import { revalidatePath } from ''next/cache'';
import { sql } from ''@/lib/db'';

export async function createCommit(branchId: string, message: string) {
  const [commit] = await sql`
    INSERT INTO commits (branch_id, commit_message, commit_hash, author_id)
    VALUES (${branchId}, ${message}, gen_random_uuid()::text, ${userId})
    RETURNING commit_id
  `;
  revalidatePath(''/dashboard'');
  return { success: true, commitId: commit.commit_id };
}')),

  (encode(digest('Performance Tip: Use Server Actions with progressive enhancement to allow form submissions even before hydration completes.', 'sha256'), 'hex'),
   'Performance Tip: Use Server Actions with progressive enhancement to allow form submissions even before hydration completes.',
   octet_length('Performance Tip: Use Server Actions with progressive enhancement to allow form submissions even before hydration completes.'));

INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash, created_at) VALUES
  ('a50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', encode(digest('Next.js 15 Server Actions & Zero-Bundle Architecture', 'sha256'), 'hex'), '2026-01-14 11:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440001', encode(digest('Server Actions in Next.js 15 execute entirely on the server runtime. By co-locating mutations with server components, client bundles remain lightweight with zero client JavaScript emitted for server-only logic.', 'sha256'), 'hex'), '2026-01-14 11:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440010', '950e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', encode(digest('''use server'';

import { revalidatePath } from ''next/cache'';
import { sql } from ''@/lib/db'';

export async function createCommit(branchId: string, message: string) {
  const [commit] = await sql`
    INSERT INTO commits (branch_id, commit_message, commit_hash, author_id)
    VALUES (${branchId}, ${message}, gen_random_uuid()::text, ${userId})
    RETURNING commit_id
  `;
  revalidatePath(''/dashboard'');
  return { success: true, commitId: commit.commit_id };
}', 'sha256'), 'hex'), '2026-01-14 11:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440011', '950e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', encode(digest('Performance Tip: Use Server Actions with progressive enhancement to allow form submissions even before hydration completes.', 'sha256'), 'hex'), '2026-01-14 11:30:00+00');

INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440005', '850e8400-e29b-41d4-a716-446655440005', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial commit: Next.js 15 server action architecture patterns', encode(digest('commit-1-note-3', 'sha256'), 'hex'), '2026-01-14 11:35:00+00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440008', 'a50e8400-e29b-41d4-a716-446655440008'),
  ('b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440009', 'a50e8400-e29b-41d4-a716-446655440009'),
  ('b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440010', 'a50e8400-e29b-41d4-a716-446655440010'),
  ('b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440011', 'a50e8400-e29b-41d4-a716-446655440011');

INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by) VALUES
  ('c50e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440003', 'v1.0 Production Guide', 'next15-guide', 'b50e8400-e29b-41d4-a716-446655440005', TRUE, '550e8400-e29b-41d4-a716-446655440001');

UPDATE notes SET default_edition_id = 'c50e8400-e29b-41d4-a716-446655440003' WHERE note_id = '750e8400-e29b-41d4-a716-446655440003';


-- 3. NOTES IN NOTEBOOK 3 (Database Internals)

-- Note 3.1: WAL & ARIES Recovery Protocol
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('750e8400-e29b-41d4-a716-446655440005', 'NOTE', '2026-01-16 09:00:00+00');
INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440003', 'Write-Ahead Logging (WAL) & ARIES Protocol', 'PUBLIC', 0);
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440005', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-16 09:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440005', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-17 10:00:00+00');

INSERT INTO branches (branch_id, note_id, branch_name, is_main, is_merged, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440005', 'main', TRUE, FALSE, '2026-01-16 09:00:00+00');

INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440012', '750e8400-e29b-41d4-a716-446655440005', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440013', '750e8400-e29b-41d4-a716-446655440005', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440014', '750e8400-e29b-41d4-a716-446655440005', '1|300000', 'QUOTE');

INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('Write-Ahead Logging (WAL) & ARIES Crash Recovery', 'sha256'), 'hex'), 
   'Write-Ahead Logging (WAL) & ARIES Crash Recovery', 
   octet_length('Write-Ahead Logging (WAL) & ARIES Crash Recovery')),

  (encode(digest('The Write-Ahead Logging (WAL) protocol dictates that changes to data pages must be written and flushed to non-volatile disk logs before the actual pages are flushed. This enables steal/no-force buffer management policies that maximize throughput.', 'sha256'), 'hex'),
   'The Write-Ahead Logging (WAL) protocol dictates that changes to data pages must be written and flushed to non-volatile disk logs before the actual pages are flushed. This enables steal/no-force buffer management policies that maximize throughput.',
   octet_length('The Write-Ahead Logging (WAL) protocol dictates that changes to data pages must be written and flushed to non-volatile disk logs before the actual pages are flushed. This enables steal/no-force buffer management policies that maximize throughput.')),

  (encode(digest('ARIES Recovery Phasing: 1. Analysis: identifies dirty pages in buffer pool. 2. Redo: repeats history from earliest unwritten LSN. 3. Undo: rolls back active uncommitted transactions.', 'sha256'), 'hex'),
   'ARIES Recovery Phasing: 1. Analysis: identifies dirty pages in buffer pool. 2. Redo: repeats history from earliest unwritten LSN. 3. Undo: rolls back active uncommitted transactions.',
   octet_length('ARIES Recovery Phasing: 1. Analysis: identifies dirty pages in buffer pool. 2. Redo: repeats history from earliest unwritten LSN. 3. Undo: rolls back active uncommitted transactions.'));

INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash, created_at) VALUES
  ('a50e8400-e29b-41d4-a716-446655440012', '950e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440002', encode(digest('Write-Ahead Logging (WAL) & ARIES Crash Recovery', 'sha256'), 'hex'), '2026-01-16 09:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440013', '950e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', encode(digest('The Write-Ahead Logging (WAL) protocol dictates that changes to data pages must be written and flushed to non-volatile disk logs before the actual pages are flushed. This enables steal/no-force buffer management policies that maximize throughput.', 'sha256'), 'hex'), '2026-01-16 09:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440014', '950e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440002', encode(digest('ARIES Recovery Phasing: 1. Analysis: identifies dirty pages in buffer pool. 2. Redo: repeats history from earliest unwritten LSN. 3. Undo: rolls back active uncommitted transactions.', 'sha256'), 'hex'), '2026-01-16 09:00:00+00');

INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440006', '850e8400-e29b-41d4-a716-446655440006', NULL, '550e8400-e29b-41d4-a716-446655440002', 'Initial commit: WAL principles and ARIES algorithm', encode(digest('commit-1-note-5', 'sha256'), 'hex'), '2026-01-16 09:05:00+00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440012', 'a50e8400-e29b-41d4-a716-446655440012'),
  ('b50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440013', 'a50e8400-e29b-41d4-a716-446655440013'),
  ('b50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440014', 'a50e8400-e29b-41d4-a716-446655440014');

INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by) VALUES
  ('c50e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440005', 'v1.0 Canonical', 'aries-wal', 'b50e8400-e29b-41d4-a716-446655440006', TRUE, '550e8400-e29b-41d4-a716-446655440002');

UPDATE notes SET default_edition_id = 'c50e8400-e29b-41d4-a716-446655440004' WHERE note_id = '750e8400-e29b-41d4-a716-446655440005';


-- 4. ISSUES & ATTEMPT BRANCHES (DEMO ZERO-CONFLICT WORKFLOW)

-- Issue 1: Open issue by Charlie targeting the Dijkstra Code Block (slot ...007)
INSERT INTO issues (issue_id, note_id, target_slot_id, creator_id, title, status, created_at) VALUES
  ('d50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 'Optimize Dijkstra PriorityQueue with Fibonacci Heap', 'OPEN', '2026-01-20 10:00:00+00');

-- Attempt branch for Charlie on Issue 1
INSERT INTO branches (branch_id, note_id, issue_id, attempted_by, branch_name, is_main, is_merged, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440002', 'd50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'issue-dijkstra/charlie-fibonacci-heap', FALSE, FALSE, '2026-01-20 10:05:00+00');

-- Commit on Charlie's branch
INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440003', '850e8400-e29b-41d4-a716-446655440003', 'b50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'WIP: Benchmark Fibonacci heap decrease-key amortized O(1)', encode(digest('commit-charlie-attempt-1', 'sha256'), 'hex'), '2026-01-20 10:15:00+00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440005', 'a50e8400-e29b-41d4-a716-446655440005'),
  ('b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440006', 'a50e8400-e29b-41d4-a716-446655440006'),
  ('b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440007', 'a50e8400-e29b-41d4-a716-446655440007');

-- Link contributor to issue
INSERT INTO issue_contributors (issue_id, contributor_id, assigned_by, assigned_at) VALUES
  ('d50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2026-01-20 10:05:00+00');


-- Issue 2 (RESOLVED / MERGED): Bob added binary search in B-Tree (demonstrates Commit Tree Branch & Merge)
INSERT INTO issues (issue_id, note_id, target_slot_id, creator_id, title, status, created_at) VALUES
  ('d50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Add binary search key lookup in B-Tree nodes', 'MERGED', '2026-01-13 14:00:00+00');

INSERT INTO branches (branch_id, note_id, issue_id, attempted_by, branch_name, is_main, is_merged, selected_by, selected_at, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001', 'd50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'issue-btree/bob-fast-search', FALSE, TRUE, '550e8400-e29b-41d4-a716-446655440001', '2026-01-14 09:00:00+00', '2026-01-13 14:05:00+00');

-- Commit on Bob's attempt branch
INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440004', 'b50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Implement O(log M) binary search over node keys', encode(digest('commit-bob-btree-fast-search', 'sha256'), 'hex'), '2026-01-13 15:00:00+00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001'),
  ('b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002'),
  ('b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440003'),
  ('b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440004');

-- Merge commit on Main branch by Alice
INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440007', '850e8400-e29b-41d4-a716-446655440001', 'b50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Merge branch ''issue-btree/bob-fast-search'' into main', encode(digest('commit-merge-btree-main', 'sha256'), 'hex'), '2026-01-14 09:00:00+00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001'),
  ('b50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002'),
  ('b50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440003'),
  ('b50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440004');


-- 5. ACCESS REQUESTS (PENDING & APPROVED WORKFLOW)

-- Diana requests access to CS 101 Study Notes (Pending)
INSERT INTO access_requests (request_id, user_id, initiated_by, resource_id, requested_role, direction, status, message, created_at) VALUES
  ('e50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', 'REQUEST', 'PENDING', 'Hi Alice! I would love to contribute notes on Red-Black Trees and A* heuristic search algorithms.', '2026-01-22 09:30:00+00');

-- Charlie requested MAINTAINER on Database Internals (Approved by Bob)
INSERT INTO access_requests (request_id, user_id, initiated_by, resource_id, requested_role, direction, status, reviewed_by, message, created_at, reviewed_at) VALUES
  ('e50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440003', 'MAINTAINER', 'REQUEST', 'APPROVED', '550e8400-e29b-41d4-a716-446655440002', 'Can I help maintain the WAL and recovery notes section?', '2026-01-18 08:00:00+00', '2026-01-18 09:00:00+00');


-- 6. NOTIFICATIONS (IN-APP COLLABORATION FEED)

-- Notifications for Alice
INSERT INTO notifications (notification_id, user_id, notification_type, title, message, link, is_read, created_at, related_resource_id, related_user_id) VALUES
  ('f50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'ACCESS_REQUEST', 'New Access Request', 'diana requested CONTRIBUTOR access on CS 101 Study Notes', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/manage', FALSE, '2026-01-22 09:30:00+00', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004'),
  ('f50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'COLLABORATOR_ADDED', 'Collaborator Added', 'bob was added as MAINTAINER to CS 101 Study Notes', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001', TRUE, '2026-01-13 12:00:00+00', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
  ('f50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'BRANCH_MERGED', 'Branch Merged', 'Bob''s branch issue-btree/bob-fast-search was merged into main', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/notes/750e8400-e29b-41d4-a716-446655440001/branches', FALSE, '2026-01-14 09:00:00+00', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002');

-- Notifications for Bob
INSERT INTO notifications (notification_id, user_id, notification_type, title, message, link, is_read, created_at, related_resource_id, related_user_id) VALUES
  ('f50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'ACCESS_GRANTED', 'Access Granted', 'You were granted MAINTAINER access to CS 101 Study Notes by alice', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001', FALSE, '2026-01-13 12:00:00+00', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'),
  ('f50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440002', 'BRANCH_MERGED', 'Your Attempt was Merged!', 'Alice merged your attempt branch for B-Tree fast search into main', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/notes/750e8400-e29b-41d4-a716-446655440001/tree', FALSE, '2026-01-14 09:00:00+00', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001');

-- Notifications for Charlie
INSERT INTO notifications (notification_id, user_id, notification_type, title, message, link, is_read, created_at, related_resource_id, related_user_id) VALUES
  ('f50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'ISSUE_ASSIGNED', 'Issue Assigned', 'You were assigned to issue: Optimize Dijkstra PriorityQueue with Fibonacci Heap', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/notes/750e8400-e29b-41d4-a716-446655440002/issues', FALSE, '2026-01-20 10:05:00+00', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001'),
  ('f50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 'ACCESS_GRANTED', 'Request Approved', 'Bob approved your request for MAINTAINER role on Database Internals', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440003', FALSE, '2026-01-18 09:00:00+00', '650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002');

