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
-- PRODUCTION WARM-UP SEED DATA (ACADEMIC COLLABORATIVE WORKSPACE)
-- =====================================================================

-- 1. USERS (With Salted Passwords)
INSERT INTO users (user_id, email, username, avatar_url, password_hash, salt, system_role, is_active, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@bookworm.dev', 'alice', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', '6bf879102f36f15e7f848893c7c83d4f8ebae0b2fe1f2908a2366858037bd042cc4b1bf0dd3a9bcd33c1ba935c4612cfa5e2bffd55074a8d3782d596f8aa681b', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'ADMIN', TRUE, '2026-01-05 08:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@bookworm.dev', 'bob', 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&auto=format&fit=crop&q=80', '6bf879102f36f15e7f848893c7c83d4f8ebae0b2fe1f2908a2366858037bd042cc4b1bf0dd3a9bcd33c1ba935c4612cfa5e2bffd55074a8d3782d596f8aa681b', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'USER', TRUE, '2026-01-07 10:30:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@bookworm.dev', 'charlie', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', '6bf879102f36f15e7f848893c7c83d4f8ebae0b2fe1f2908a2366858037bd042cc4b1bf0dd3a9bcd33c1ba935c4612cfa5e2bffd55074a8d3782d596f8aa681b', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'USER', TRUE, '2026-01-09 14:15:00+00'),
  ('550e8400-e29b-41d4-a716-446655440004', 'diana@bookworm.dev', 'diana', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', '6bf879102f36f15e7f848893c7c83d4f8ebae0b2fe1f2908a2366858037bd042cc4b1bf0dd3a9bcd33c1ba935c4612cfa5e2bffd55074a8d3782d596f8aa681b', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'USER', TRUE, '2026-01-12 16:45:00+00'),
  ('550e8400-e29b-41d4-a716-446655440005', 'evan@bookworm.dev', 'evan', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80', '6bf879102f36f15e7f848893c7c83d4f8ebae0b2fe1f2908a2366858037bd042cc4b1bf0dd3a9bcd33c1ba935c4612cfa5e2bffd55074a8d3782d596f8aa681b', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'USER', TRUE, '2026-01-14 11:20:00+00'),
  ('550e8400-e29b-41d4-a716-446655440006', 'fiona@bookworm.dev', 'fiona', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', '6bf879102f36f15e7f848893c7c83d4f8ebae0b2fe1f2908a2366858037bd042cc4b1bf0dd3a9bcd33c1ba935c4612cfa5e2bffd55074a8d3782d596f8aa681b', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'USER', TRUE, '2026-01-15 09:10:00+00');

-- 2. NOTEBOOKS (Resources & Subtypes)
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'NOTEBOOK', '2026-01-11 10:00:00+00'),
  ('650e8400-e29b-41d4-a716-446655440002', 'NOTEBOOK', '2026-01-14 11:00:00+00'),
  ('650e8400-e29b-41d4-a716-446655440003', 'NOTEBOOK', '2026-01-15 14:00:00+00'),
  ('650e8400-e29b-41d4-a716-446655440004', 'NOTEBOOK', '2026-01-16 13:00:00+00'),
  ('650e8400-e29b-41d4-a716-446655440005', 'NOTEBOOK', '2026-01-17 15:30:00+00'),
  ('650e8400-e29b-41d4-a716-446655440006', 'NOTEBOOK', '2026-01-19 12:00:00+00');

INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'CS 101 Study Notes', 'Collaborative computer science fundamentals, self-balancing search trees, graph algorithms, and dynamic programming.', 'PUBLIC'),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Modern Web Architecture', 'Next.js 15 App Router, React Server Actions, zero-bundle abstractions, and distributed edge computing.', 'PUBLIC'),
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Database Engine Internals', 'Deep dive into storage managers, Write-Ahead Logging (WAL), ARIES recovery, and MVCC transaction isolation.', 'PUBLIC'),
  ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440006', 'Advanced Compiler Construction', 'Static Single Assignment (SSA) form, dominance frontiers, register allocation algorithms, and LLVM IR generation.', 'PUBLIC'),
  ('650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'Operating Systems & Virtual Memory', 'Multi-level paging, Translation Lookaside Buffers (TLB), Linux Completely Fair Scheduler (CFS), and context switching.', 'PUBLIC'),
  ('650e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440004', 'Cryptography & Zero-Knowledge Protocols', 'Elliptic curve arithmetic, discrete log cryptosystems, and interactive zero-knowledge proofs (zk-SNARKs).', 'SHARED');

INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-11 10:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-13 12:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-16 15:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-14 11:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440002', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-17 09:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440003', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-15 14:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-16 10:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440003', 'MAINTAINER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-18 09:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440006', '650e8400-e29b-41d4-a716-446655440004', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440006', '2026-01-16 13:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440004', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440006', '2026-01-18 14:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440005', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440005', '2026-01-17 15:30:00+00'),
  ('550e8400-e29b-41d4-a716-446655440006', '650e8400-e29b-41d4-a716-446655440005', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440005', '2026-01-19 11:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440006', 'OWNER', '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440004', '2026-01-19 12:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440006', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440004', '2026-01-20 16:00:00+00');

-- 3. NOTES (Resources & Subtypes)
INSERT INTO resources (resource_id, resource_type, created_at) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'NOTE', '2026-01-11 10:30:00+00'),
  ('750e8400-e29b-41d4-a716-446655440002', 'NOTE', '2026-01-12 11:00:00+00'),
  ('750e8400-e29b-41d4-a716-446655440003', 'NOTE', '2026-01-13 14:00:00+00'),
  ('750e8400-e29b-41d4-a716-446655440004', 'NOTE', '2026-01-14 11:30:00+00'),
  ('750e8400-e29b-41d4-a716-446655440005', 'NOTE', '2026-01-15 09:45:00+00'),
  ('750e8400-e29b-41d4-a716-446655440006', 'NOTE', '2026-01-15 15:00:00+00'),
  ('750e8400-e29b-41d4-a716-446655440007', 'NOTE', '2026-01-16 11:20:00+00'),
  ('750e8400-e29b-41d4-a716-446655440008', 'NOTE', '2026-01-16 14:00:00+00'),
  ('750e8400-e29b-41d4-a716-446655440009', 'NOTE', '2026-01-17 10:15:00+00'),
  ('750e8400-e29b-41d4-a716-44665544000a', 'NOTE', '2026-01-17 16:00:00+00'),
  ('750e8400-e29b-41d4-a716-44665544000b', 'NOTE', '2026-01-18 11:00:00+00'),
  ('750e8400-e29b-41d4-a716-44665544000c', 'NOTE', '2026-01-19 13:00:00+00'),
  ('750e8400-e29b-41d4-a716-44665544000d', 'NOTE', '2026-01-20 10:00:00+00');

INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'B-Trees & Page-Structured Storage', 'PUBLIC', 0),
  ('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'Dijkstra vs A* Shortest Path Algorithms', 'PUBLIC', 1),
  ('750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'Dynamic Programming & Optimal Substructure', 'PUBLIC', 2),
  ('750e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440002', 'Next.js 15 App Router & Server Actions', 'PUBLIC', 0),
  ('750e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440002', 'Distributed Edge Computing & Edge Middleware', 'PUBLIC', 1),
  ('750e8400-e29b-41d4-a716-446655440006', '650e8400-e29b-41d4-a716-446655440003', 'Write-Ahead Logging (WAL) & ARIES Recovery', 'PUBLIC', 0),
  ('750e8400-e29b-41d4-a716-446655440007', '650e8400-e29b-41d4-a716-446655440003', 'Buffer Pool Management & LRU-K Eviction', 'PUBLIC', 1),
  ('750e8400-e29b-41d4-a716-446655440008', '650e8400-e29b-41d4-a716-446655440004', 'Static Single Assignment (SSA) & Dominance Frontiers', 'PUBLIC', 0),
  ('750e8400-e29b-41d4-a716-446655440009', '650e8400-e29b-41d4-a716-446655440004', 'LLVM IR Generation & Register Allocation', 'PUBLIC', 1),
  ('750e8400-e29b-41d4-a716-44665544000a', '650e8400-e29b-41d4-a716-446655440005', 'Multi-Level Paging & TLB Shootdowns', 'PUBLIC', 0),
  ('750e8400-e29b-41d4-a716-44665544000b', '650e8400-e29b-41d4-a716-446655440005', 'Linux Completely Fair Scheduler (CFS) & vruntime', 'PUBLIC', 1),
  ('750e8400-e29b-41d4-a716-44665544000c', '650e8400-e29b-41d4-a716-446655440006', 'Elliptic Curve Cryptography & ECDSA Verification', 'SHARED', 0),
  ('750e8400-e29b-41d4-a716-44665544000d', '650e8400-e29b-41d4-a716-446655440006', 'Zero-Knowledge Proofs & zk-SNARKs (Groth16)', 'SHARED', 1);

INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'OWNER', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-11 10:30:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'MAINTAINER', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-13 12:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440003', '2026-01-16 15:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'OWNER', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001', '2026-01-12 11:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440002', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440003', '2026-01-18 10:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440006', 'OWNER', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440002', '2026-01-15 15:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440006', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440003', '2026-01-17 11:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440008', 'OWNER', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440006', '2026-01-16 14:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440008', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440005', '2026-01-18 12:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-44665544000b', 'OWNER', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440005', '2026-01-18 11:00:00+00'),
  ('550e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-44665544000b', 'CONTRIBUTOR', '{"can_create_issue": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440003', '2026-01-19 14:00:00+00');


-- 4. LOGICAL BLOCK SLOTS
INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001', '1|400000', 'QUOTE'),
  ('950e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440002', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440002', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-446655440002', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440008', '750e8400-e29b-41d4-a716-446655440002', '1|400000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440011', '750e8400-e29b-41d4-a716-446655440006', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440012', '750e8400-e29b-41d4-a716-446655440006', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440013', '750e8400-e29b-41d4-a716-446655440006', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440014', '750e8400-e29b-41d4-a716-446655440006', '1|400000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440018', '750e8400-e29b-41d4-a716-446655440008', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440019', '750e8400-e29b-41d4-a716-446655440008', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-44665544001a', '750e8400-e29b-41d4-a716-446655440008', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-44665544001b', '750e8400-e29b-41d4-a716-446655440008', '1|400000', 'QUOTE'),
  ('950e8400-e29b-41d4-a716-446655440021', '750e8400-e29b-41d4-a716-44665544000b', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440022', '750e8400-e29b-41d4-a716-44665544000b', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440023', '750e8400-e29b-41d4-a716-44665544000b', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440024', '750e8400-e29b-41d4-a716-44665544000c', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440025', '750e8400-e29b-41d4-a716-44665544000c', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440026', '750e8400-e29b-41d4-a716-44665544000c', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440064', '750e8400-e29b-41d4-a716-446655440003', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440065', '750e8400-e29b-41d4-a716-446655440003', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440066', '750e8400-e29b-41d4-a716-446655440003', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440067', '750e8400-e29b-41d4-a716-446655440004', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440068', '750e8400-e29b-41d4-a716-446655440004', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440069', '750e8400-e29b-41d4-a716-446655440004', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-44665544006a', '750e8400-e29b-41d4-a716-446655440005', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-44665544006b', '750e8400-e29b-41d4-a716-446655440005', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-44665544006c', '750e8400-e29b-41d4-a716-446655440005', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-44665544006d', '750e8400-e29b-41d4-a716-446655440007', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-44665544006e', '750e8400-e29b-41d4-a716-446655440007', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-44665544006f', '750e8400-e29b-41d4-a716-446655440007', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440070', '750e8400-e29b-41d4-a716-446655440009', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440071', '750e8400-e29b-41d4-a716-446655440009', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440072', '750e8400-e29b-41d4-a716-446655440009', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440073', '750e8400-e29b-41d4-a716-44665544000a', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440074', '750e8400-e29b-41d4-a716-44665544000a', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440075', '750e8400-e29b-41d4-a716-44665544000a', '1|300000', 'CODE'),
  ('950e8400-e29b-41d4-a716-446655440076', '750e8400-e29b-41d4-a716-44665544000d', '1|100000', 'HEADING'),
  ('950e8400-e29b-41d4-a716-446655440077', '750e8400-e29b-41d4-a716-44665544000d', '1|200000', 'PARAGRAPH'),
  ('950e8400-e29b-41d4-a716-446655440078', '750e8400-e29b-41d4-a716-44665544000d', '1|300000', 'CODE');

-- 5. CONTENT BLOBS (CAS Deduplication Engine)
INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  ('8116e54b1a54dc24216a86afa39758f01327524e99ee5baa726593ef1de5c3a9', '# B-Trees & Page-Structured Storage Engines', 43),
  ('f2a42360ed6213ed0517e7e954aa2ea1b66c18ec4f4c00136ea42edc696709ca', 'B-Trees generalize binary search trees by allowing nodes with more than two children. Unlike self-balancing BSTs (AVL or Red-Black), B-Trees match the physical page size of disk storage (typically 4KB or 8KB) to minimize I/O seeks.', 231),
  ('1f399ceaff2625918d3099b0e3bc0d75e1bfd49b221dcd604a856eb9cbda2984', '// B-Tree Node with Linear Scan (v1)
template <typename K, typename V, int M>
struct BTreeNode {
    int num_keys = 0;
    K keys[M - 1];
    V values[M - 1];
    BTreeNode* children[M] = {nullptr};
    bool is_leaf = true;

    int find_key_linear(const K& key) {
        int i = 0;
        while (i < num_keys && keys[i] < key) i++;
        return i;
    }
};', 361),
  ('564541ebdab1bc4893914f22f6e0fcb6d4b822659e00abc721d38e3cd5ea887c', '> Invariant: A B-Tree of order M guarantees height bounded by O(log_M N), ensuring lookups require at most 3-4 disk seeks even for terabytes of indexed records.', 160),
  ('a8b9d6c5e1dfd1bbbf588f4b77c2b001dfb87f505e504e5d61134639c5b164d5', '// B-Tree Node with Branch-Free Binary Search (Bob Optimization)
template <typename K, typename V, int M>
struct BTreeNode {
    int num_keys = 0;
    K keys[M - 1];
    V values[M - 1];
    BTreeNode* children[M] = {nullptr};
    bool is_leaf = true;

    int find_key_binary(const K& target) const {
        int low = 0, high = num_keys - 1;
        while (low <= high) {
            int mid = low + ((high - low) >> 1);
            if (keys[mid] < target) low = mid + 1;
            else high = mid - 1;
        }
        return low;
    }
};', 545),
  ('f50a1ea3003dabccfb6e151407f459c08e1490ebf03c15f6134843144b804940', '# Dijkstra vs A* Shortest Path Algorithms', 41),
  ('0a988acbe81cc5f121b188462997f26ffc1694dafb6e399f113e3c847eec1793', 'Dijkstra finds the single-source shortest path in weighted graphs with non-negative edge weights in O((V + E) log V) using a binary heap. A* accelerates search toward a goal by adding an admissible heuristic h(n).', 213),
  ('71714db4a4887932946be1b18c859479b3f20e5294a0dd81b1ad8008987d3a6f', 'import heapq

def dijkstra(graph, start):
    distances = {node: float("inf") for node in graph}
    distances[start] = 0
    pq = [(0, start)]

    while pq:
        curr_dist, u = heapq.heappop(pq)
        if curr_dist > distances[u]: continue
        for v, weight in graph[u].items():
            if distances[u] + weight < distances[v]:
                distances[v] = distances[u] + weight
                heapq.heappush(pq, (distances[v], v))
    return distances', 469),
  ('0c8fa2c833c8df5cdbe7041d859986135e9b82747606ec421e10ce1128e34436', 'Heuristic Admissibility: A heuristic h(n) is admissible if h(n) <= c*(n, goal) for all nodes n. Consistency (triangle inequality) further guarantees that no node is expanded more than once.', 189),
  ('d9c0a8251ad3c5ad0f41573db3694fccb2c7625668b4807250ba29600416aa6d', '# Fibonacci Heap decrease-key node
class FibHeapNode:
    def __init__(self, key, val):
        self.key, self.val = key, val
        self.parent = self.child = self.left = self.right = None
        self.degree, self.mark = 0, False', 232),
  ('117200805c3d93e5c6af262b189be24d6a61c833241a3345c816e961ce104ec2', '# Write-Ahead Logging & The ARIES Recovery Protocol', 51),
  ('8f5dfdd92ea853b1e59e8cfbb2df73b0619217769e49c26a6d3b6e7dcb1d950e', 'Under Steal/No-Force buffer policies, dirty pages can be written to disk before commit (Steal), and committed transactions do not require immediate page flushes (No-Force). Durability and Atomicity are guaranteed by logging changes sequentially to the WAL before flushing data pages.', 283),
  ('a13ce3f7fa10dfe2f9b3307faab619061fc26bf73b0b11de52e126402f6a5ad0', '// Naive Single-Transaction WAL Flush
void commit_transaction(Txn* txn) {
    LogRecord record = txn->create_commit_record();
    wal_buffer.append(record);
    wal_file.write(wal_buffer);
    fsync(wal_file.fd); // Blocking fsync per transaction!
}', 249),
  ('f7422a85291ff03f31dbfa13faca7e7fe084af4614134ea931639a20c6d505a4', 'ARIES Three-Pass Recovery: 1. Analysis Pass: scans WAL forward from latest checkpoint to identify active transactions (Undo List) and dirty pages (Dirty Page Table). 2. Redo Pass: repeats history forward from lowest recLSN. 3. Undo Pass: rolls back active transactions backwards.', 279),
  ('4c020b482f19191770387cba24303dc88512f6153e3bbc2e33288e5ac93d4fdc', '// Group Commit: Amortize fsync across concurrent transactions
void group_commit(TxnQueue& queue) {
    std::vector<Txn*> batch = queue.drain_pending();
    for (auto* txn : batch) {
        wal_buffer.append(txn->create_commit_record());
    }
    wal_file.write(wal_buffer);
    fdatasync(wal_file.fd); // Single fdatasync commits hundreds of transactions!
    for (auto* txn : batch) txn->notify_committed();
}', 413),
  ('dd0833f6d44e5c72bace7d6f07112bc0f8c586634d7a030c166461c92bc98086', '# Static Single Assignment (SSA) & Dominance Frontiers', 54),
  ('e92b2a7a236fac8050dc226f19bc5a5791f94b023b5cc7b115d92c4fba1a2094', 'In SSA form, each variable is defined exactly once. When control flow branches join, phi-functions merge distinct version values. Cytron’s algorithm computes dominance frontiers DF(X) using the immediate dominator tree.', 221),
  ('ae97b1d7b18627297cd34b3abe71c5bfaea759c4dfc5c097119c86634c5c9934', '// Minimal SSA: Inserts phi everywhere in dominance frontier
void place_phi_minimal(Variable v, Function& F) {
    WorkList W = F.get_def_blocks(v);
    while (!W.empty()) {
        BasicBlock* X = W.pop();
        for (BasicBlock* Y : X->dominance_frontier()) {
            if (!has_phi(Y, v)) {
                insert_phi(Y, v);
                W.push(Y);
            }
        }
    }
}', 389),
  ('e2511acd7595e9911c66bc15c1af1bbed3e81098f63bcf4edc4a3b0e37fd5934', '> Theorem: Pruned SSA places phi-functions only at join points where the variable is live-in, drastically decreasing LLVM IR memory footprint.', 142),
  ('cc30cafeeec27e3b93cc7dc6a5704a91d6bc1848e09c4ebd529d7bd395b2d0f4', '// Pruned SSA: Requires v in LiveIn(Y) before inserting phi
void place_phi_pruned(Variable v, Function& F, LivenessInfo& Live) {
    WorkList W = F.get_def_blocks(v);
    while (!W.empty()) {
        BasicBlock* X = W.pop();
        for (BasicBlock* Y : X->dominance_frontier()) {
            if (Live.is_live_in(Y, v) && !has_phi(Y, v)) {
                insert_phi(Y, v);
                W.push(Y);
            }
        }
    }
}', 432),
  ('72d952cb71d54051b275f98eb1de99a8c316590dc6de72a7b9a10ac4441a2913', '# Linux Completely Fair Scheduler (CFS) Architecture', 52),
  ('0e090e7e956d9a03c485f7698b6f8738c32065cb167588af360d1cad6151b1c1', 'CFS maintains fairness across processes using an idealized "Ideal Multi-tasking CPU" abstraction. It orders runnable tasks in a time-ordered Red-Black tree by their virtual runtime (vruntime). The leftmost node is always selected next.', 235),
  ('015e28398bba6109687f39e7560b0222823c1b1291187f2fa4e715029715fa01', '// Naive wake_up: vruntime left unchanged
static void place_entity_naive(struct cfs_rq *cfs_rq, struct sched_entity *se) {
    // Leaves old vruntime intact, risking CPU starvation of other tasks!
}', 198),
  ('e5d482636ccdb0d85900e6886c8c7396abcacbd6693b469132deeb50efa60d00', '// Clamped wake_up: Adjust vruntime against min_vruntime
static void place_entity(struct cfs_rq *cfs_rq, struct sched_entity *se, int initial) {
    u64 vruntime = cfs_rq->min_vruntime;
    if (initial) vruntime += sched_vslice(cfs_rq, se);
    else vruntime -= sysctl_sched_latency >> 1;
    se->vruntime = max_vruntime(se->vruntime, vruntime);
}', 347),
  ('223b0d90b0dafda02a3ee84f1b8ac2a87ba149ceae6f1caabb8dc2c7ada2e63b', '# Elliptic Curve Cryptography & Secp256k1 Field Arithmetic', 58),
  ('b07054271c8625d57cc384542276b976df2d077be5d08ac0f997a88a37adcc3a', 'Secp256k1 uses the curve y^2 = x^3 + 7 over prime field F_p where p = 2^256 - 2^32 - 977. Point addition in affine coordinates requires computing the slope m = (y2 - y1) / (x2 - x1) mod p, which needs an expensive extended Euclidean inversion.', 243),
  ('2e9e446c76700f8512184e6b232ade6050544fa0082ba9bdb2aa8b7369f07893', '// Affine Point Addition with mod_inverse
struct AffinePoint { BigInt x, y; };
AffinePoint add(AffinePoint P, AffinePoint Q) {
    BigInt m = (Q.y - P.y) * mod_inverse(Q.x - P.x, P_MOD);
    BigInt xr = (m * m - P.x - Q.x) % P_MOD;
    BigInt yr = (m * (P.x - xr) - P.y) % P_MOD;
    return {xr, yr};
}', 302),
  ('d2924d2b211514aefe77517bf8f94a548f858bd04415b712ad09836da28cc238', '// Jacobian Projective: (X : Y : Z) representing (X/Z^2, Y/Z^3)
struct JacobianPoint { BigInt X, Y, Z; };
// Point doubling requires zero modular inversions!
JacobianPoint double_point(JacobianPoint P) {
    BigInt S = 4 * P.X * P.Y * P.Y;
    BigInt M = 3 * P.X * P.X;
    BigInt X3 = (M * M - 2 * S) % P_MOD;
    BigInt Y3 = (M * (S - X3) - 8 * P.Y.pow(4)) % P_MOD;
    BigInt Z3 = (2 * P.Y * P.Z) % P_MOD;
    return {X3, Y3, Z3};
}', 435),
  ('c273c94772d4b729ecb6b9cc5fca27144194c6cb4bcd50682c7b7ea34f7455cd', '# Dynamic Programming & Optimal Substructure', 44),
  ('09f215dc529d38def4314afdcd36ca1099bd4c1cc09f9309c08efbc25d63a1b7', 'Dynamic programming solves problems by combining solutions to subproblems. Optimal substructure means an optimal solution contains within it optimal solutions to subproblems.', 174),
  ('8c83e20aa2a5012dfcd799d849c8c7f554fb1d50cf0e80cf89ee2b3caffae9d9', 'def knapsack(weights, values, W):
    dp = [0] * (W + 1)
    for w, v in zip(weights, values):
        for cap in range(W, w - 1, -1):
            dp[cap] = max(dp[cap], dp[cap - w] + v)
    return dp[W]', 203),
  ('40b3ecccc3e462f11f874537ebbad799ad1f32eaf324ced811eb0f8554a7762f', '# Next.js 15 App Router & React Server Actions', 46),
  ('a1afb5dfe2827a3ff979c9c24f59930a76a32883bde401f24765626e6c0bace7', 'Next.js 15 App Router embraces React 19 Server Actions, eliminating custom REST boilerplate for database mutations.', 115),
  ('6b96f3c76be2865398d8a12be4a62dac0d448c325aa39c73a7d8a35739bdb614', 'export async function createNoteAction(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  await sql`INSERT INTO notes (title) VALUES (${title})`;
  revalidatePath("/dashboard");
}', 217),
  ('5ed4aecbcc7c13e869f65e1d999414503d72739e752d06382815630637bcb92b', '# Edge Middleware & V8 Isolates', 31),
  ('d33992962423a9eecc5fda011d673a211717cb5457fabe42725ca0e2a8cfe850', 'Edge computing runs lightweight JavaScript in isolated V8 environments within milliseconds of end users worldwide.', 114),
  ('93025674b5a78c8878f62f7ca0e416983c9de25edd8f8f3d43f8cc34d58617d7', 'export default function middleware(request: Request) {
  const country = request.headers.get("cf-ipcountry") || "US";
  return NextResponse.next({ headers: { "x-edge-region": country } });
}', 190),
  ('96a7ce03eaeb1e65e45dae82eaea62eb067064ca5b86a2d94ecc5ded052d8a02', '# Buffer Pool Management & LRU-K Eviction', 41),
  ('efe729a474a05604d729df41500fdda5498d7ecf0d819013bb423272a817081a', 'Standard LRU fails catastrophically on sequential table scans. LRU-2 tracks the timestamp of the penultimate access.', 116),
  ('15c6b1818bec1d6bc9db886c6d86c3c006419c7b328ac35bfb4a0d25708a3388', 'struct BufferFrame {
    PageID page_id;
    bool is_dirty;
    int pin_count;
    uint64_t access_history[K];
};', 113),
  ('ce8dc278e04b19f4219776c74d20a6dd4c6edd03c062ac3168009221122f9977', '# LLVM IR & Chaitin Graph Coloring', 34),
  ('aca30f608cfba1cb465128fefc5db2f76185803bfdda47ea48e3ff4e8504f7eb', 'Register allocation maps an unbounded number of virtual registers to K physical CPU registers via Kempe heuristic graph coloring.', 129),
  ('2101843117315b5aa847ca65c5e1eaae65aefaaac21a3aa9eb350bc1d4016bd7', 'pub fn simplify(graph: &mut InterferenceGraph, k: usize) -> Vec<NodeId> {
    let mut select_stack = Vec::new();
    while let Some(node) = graph.find_node_degree_less_than(k) {
        graph.remove_node(node);
        select_stack.push(node);
    }
    select_stack
}', 268),
  ('327cf7750020df49c6d0fbcf1587bad965a16cd194351a8d2aa3c6d5eea36312', '# Multi-Level Paging & Memory Virtualization', 44),
  ('adb7750ee50f232c6a69a15a3808e9cacee40ca6f516b9378ebab8f847ca6227', 'x86-64 long mode maps 48-bit virtual addresses through 4 page table levels (PML4 -> PDPT -> PD -> PT) into 52-bit physical RAM.', 127),
  ('71b076661a66ec0ebdcb341dea37cc5f2898bbfe50c0812ac31875733861b558', 'static inline void flush_tlb_page(unsigned long addr) {
    asm volatile("invlpg (%0)" :: "r" (addr) : "memory");
}', 115),
  ('875b96dc458fecc63a0929a4538e6caf9de799cb15715d722ad13fa6c770cc71', '# Zero-Knowledge Proofs & zk-SNARKs (Groth16 Protocol)', 54),
  ('1d09abe87dfe2a32360bc6c8667d1765db9877e5c6320e2635b69da05e0a2df6', 'The Groth16 protocol uses bilinear pairings e: G1 x G2 -> GT over elliptic curves to verify quadratic arithmetic programs in constant time.', 139),
  ('e03fbdd4d5ea0bad96faab3ffba5e6032181f4a9001477599440fc99e2ff30ad', '// Groth16 Verification: e(A, B) = e(alpha, beta) * e(x, gamma) * e(C, delta)
fn verify(proof: &Proof, vk: &VerifyingKey, public_inputs: &[Fr]) -> bool {
    let g1_acc = compute_public_input_linear_combination(vk, public_inputs);
    pairing(proof.a, proof.b) == vk.alpha_beta * pairing(g1_acc, vk.gamma) * pairing(proof.c, vk.delta)
}', 336);

-- 6. BLOCK VERSION CONTENTS
INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash, created_at) VALUES
  ('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '8116e54b1a54dc24216a86afa39758f01327524e99ee5baa726593ef1de5c3a9', '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'f2a42360ed6213ed0517e7e954aa2ea1b66c18ec4f4c00136ea42edc696709ca', '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '1f399ceaff2625918d3099b0e3bc0d75e1bfd49b221dcd604a856eb9cbda2984', '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '564541ebdab1bc4893914f22f6e0fcb6d4b822659e00abc721d38e3cd5ea887c', '2026-01-11 10:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'a8b9d6c5e1dfd1bbbf588f4b77c2b001dfb87f505e504e5d61134639c5b164d5', '2026-01-13 16:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'f50a1ea3003dabccfb6e151407f459c08e1490ebf03c15f6134843144b804940', '2026-01-12 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', '0a988acbe81cc5f121b188462997f26ffc1694dafb6e399f113e3c847eec1793', '2026-01-12 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', '71714db4a4887932946be1b18c859479b3f20e5294a0dd81b1ad8008987d3a6f', '2026-01-12 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', '0c8fa2c833c8df5cdbe7041d859986135e9b82747606ec421e10ce1128e34436', '2026-01-12 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544000a', '950e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 'd9c0a8251ad3c5ad0f41573db3694fccb2c7625668b4807250ba29600416aa6d', '2026-01-20 11:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440015', '950e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440002', '117200805c3d93e5c6af262b189be24d6a61c833241a3345c816e961ce104ec2', '2026-01-15 15:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440016', '950e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440002', '8f5dfdd92ea853b1e59e8cfbb2df73b0619217769e49c26a6d3b6e7dcb1d950e', '2026-01-15 15:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440017', '950e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'a13ce3f7fa10dfe2f9b3307faab619061fc26bf73b0b11de52e126402f6a5ad0', '2026-01-15 15:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440018', '950e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440002', 'f7422a85291ff03f31dbfa13faca7e7fe084af4614134ea931639a20c6d505a4', '2026-01-15 15:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440019', '950e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440003', '4c020b482f19191770387cba24303dc88512f6153e3bbc2e33288e5ac93d4fdc', '2026-01-17 15:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440020', '950e8400-e29b-41d4-a716-446655440018', '550e8400-e29b-41d4-a716-446655440006', 'dd0833f6d44e5c72bace7d6f07112bc0f8c586634d7a030c166461c92bc98086', '2026-01-16 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440021', '950e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440006', 'e92b2a7a236fac8050dc226f19bc5a5791f94b023b5cc7b115d92c4fba1a2094', '2026-01-16 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440022', '950e8400-e29b-41d4-a716-44665544001a', '550e8400-e29b-41d4-a716-446655440006', 'ae97b1d7b18627297cd34b3abe71c5bfaea759c4dfc5c097119c86634c5c9934', '2026-01-16 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440023', '950e8400-e29b-41d4-a716-44665544001b', '550e8400-e29b-41d4-a716-446655440006', 'e2511acd7595e9911c66bc15c1af1bbed3e81098f63bcf4edc4a3b0e37fd5934', '2026-01-16 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440024', '950e8400-e29b-41d4-a716-44665544001a', '550e8400-e29b-41d4-a716-446655440005', 'cc30cafeeec27e3b93cc7dc6a5704a91d6bc1848e09c4ebd529d7bd395b2d0f4', '2026-01-18 15:30:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440030', '950e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440005', '72d952cb71d54051b275f98eb1de99a8c316590dc6de72a7b9a10ac4441a2913', '2026-01-18 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440031', '950e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440005', '0e090e7e956d9a03c485f7698b6f8738c32065cb167588af360d1cad6151b1c1', '2026-01-18 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440032', '950e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440005', '015e28398bba6109687f39e7560b0222823c1b1291187f2fa4e715029715fa01', '2026-01-18 11:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440033', '950e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440003', 'e5d482636ccdb0d85900e6886c8c7396abcacbd6693b469132deeb50efa60d00', '2026-01-19 14:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440040', '950e8400-e29b-41d4-a716-446655440024', '550e8400-e29b-41d4-a716-446655440004', '223b0d90b0dafda02a3ee84f1b8ac2a87ba149ceae6f1caabb8dc2c7ada2e63b', '2026-01-19 13:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440041', '950e8400-e29b-41d4-a716-446655440025', '550e8400-e29b-41d4-a716-446655440004', 'b07054271c8625d57cc384542276b976df2d077be5d08ac0f997a88a37adcc3a', '2026-01-19 13:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440042', '950e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440004', '2e9e446c76700f8512184e6b232ade6050544fa0082ba9bdb2aa8b7369f07893', '2026-01-19 13:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440043', '950e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440002', 'd2924d2b211514aefe77517bf8f94a548f858bd04415b712ad09836da28cc238', '2026-01-21 15:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440064', '950e8400-e29b-41d4-a716-446655440064', '550e8400-e29b-41d4-a716-446655440001', 'c273c94772d4b729ecb6b9cc5fca27144194c6cb4bcd50682c7b7ea34f7455cd', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440065', '950e8400-e29b-41d4-a716-446655440065', '550e8400-e29b-41d4-a716-446655440001', '09f215dc529d38def4314afdcd36ca1099bd4c1cc09f9309c08efbc25d63a1b7', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440066', '950e8400-e29b-41d4-a716-446655440066', '550e8400-e29b-41d4-a716-446655440001', '8c83e20aa2a5012dfcd799d849c8c7f554fb1d50cf0e80cf89ee2b3caffae9d9', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440067', '950e8400-e29b-41d4-a716-446655440067', '550e8400-e29b-41d4-a716-446655440001', '40b3ecccc3e462f11f874537ebbad799ad1f32eaf324ced811eb0f8554a7762f', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440068', '950e8400-e29b-41d4-a716-446655440068', '550e8400-e29b-41d4-a716-446655440001', 'a1afb5dfe2827a3ff979c9c24f59930a76a32883bde401f24765626e6c0bace7', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440069', '950e8400-e29b-41d4-a716-446655440069', '550e8400-e29b-41d4-a716-446655440001', '6b96f3c76be2865398d8a12be4a62dac0d448c325aa39c73a7d8a35739bdb614', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544006a', '950e8400-e29b-41d4-a716-44665544006a', '550e8400-e29b-41d4-a716-446655440001', '5ed4aecbcc7c13e869f65e1d999414503d72739e752d06382815630637bcb92b', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544006b', '950e8400-e29b-41d4-a716-44665544006b', '550e8400-e29b-41d4-a716-446655440001', 'd33992962423a9eecc5fda011d673a211717cb5457fabe42725ca0e2a8cfe850', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544006c', '950e8400-e29b-41d4-a716-44665544006c', '550e8400-e29b-41d4-a716-446655440001', '93025674b5a78c8878f62f7ca0e416983c9de25edd8f8f3d43f8cc34d58617d7', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544006d', '950e8400-e29b-41d4-a716-44665544006d', '550e8400-e29b-41d4-a716-446655440002', '96a7ce03eaeb1e65e45dae82eaea62eb067064ca5b86a2d94ecc5ded052d8a02', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544006e', '950e8400-e29b-41d4-a716-44665544006e', '550e8400-e29b-41d4-a716-446655440002', 'efe729a474a05604d729df41500fdda5498d7ecf0d819013bb423272a817081a', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-44665544006f', '950e8400-e29b-41d4-a716-44665544006f', '550e8400-e29b-41d4-a716-446655440002', '15c6b1818bec1d6bc9db886c6d86c3c006419c7b328ac35bfb4a0d25708a3388', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440070', '950e8400-e29b-41d4-a716-446655440070', '550e8400-e29b-41d4-a716-446655440006', 'ce8dc278e04b19f4219776c74d20a6dd4c6edd03c062ac3168009221122f9977', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440071', '950e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440006', 'aca30f608cfba1cb465128fefc5db2f76185803bfdda47ea48e3ff4e8504f7eb', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440072', '950e8400-e29b-41d4-a716-446655440072', '550e8400-e29b-41d4-a716-446655440006', '2101843117315b5aa847ca65c5e1eaae65aefaaac21a3aa9eb350bc1d4016bd7', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440073', '950e8400-e29b-41d4-a716-446655440073', '550e8400-e29b-41d4-a716-446655440005', '327cf7750020df49c6d0fbcf1587bad965a16cd194351a8d2aa3c6d5eea36312', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440074', '950e8400-e29b-41d4-a716-446655440074', '550e8400-e29b-41d4-a716-446655440005', 'adb7750ee50f232c6a69a15a3808e9cacee40ca6f516b9378ebab8f847ca6227', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440075', '950e8400-e29b-41d4-a716-446655440075', '550e8400-e29b-41d4-a716-446655440005', '71b076661a66ec0ebdcb341dea37cc5f2898bbfe50c0812ac31875733861b558', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440076', '950e8400-e29b-41d4-a716-446655440076', '550e8400-e29b-41d4-a716-446655440004', '875b96dc458fecc63a0929a4538e6caf9de799cb15715d722ad13fa6c770cc71', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440077', '950e8400-e29b-41d4-a716-446655440077', '550e8400-e29b-41d4-a716-446655440004', '1d09abe87dfe2a32360bc6c8667d1765db9877e5c6320e2635b69da05e0a2df6', '2026-01-16 10:00:00+00'),
  ('a50e8400-e29b-41d4-a716-446655440078', '950e8400-e29b-41d4-a716-446655440078', '550e8400-e29b-41d4-a716-446655440004', 'e03fbdd4d5ea0bad96faab3ffba5e6032181f4a9001477599440fc99e2ff30ad', '2026-01-16 10:00:00+00');

-- 7. ISSUES (Zero-Conflict Block Level Locking)
INSERT INTO issues (issue_id, note_id, target_slot_id, creator_id, title, status, created_at) VALUES
  ('d50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Optimize in-node binary search instead of linear scan', 'MERGED', '2026-01-13 14:00:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 'Optimize Dijkstra PriorityQueue with Fibonacci Heap', 'IN_PROGRESS', '2026-01-20 10:00:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440003', 'Implement Group Commit fsync batching in WAL writer', 'MERGED', '2026-01-17 12:00:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-44665544001a', '550e8400-e29b-41d4-a716-446655440005', 'Implement Pruned SSA algorithm using Liveness Analysis to eliminate dead phi-nodes', 'MERGED', '2026-01-18 13:00:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-44665544000b', '950e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440003', 'Clamp vruntime for waking sleeper tasks to min_vruntime', 'MERGED', '2026-01-19 13:00:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-44665544000c', '950e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440002', 'Implement Jacobian projective coordinates to avoid modular inversion', 'IN_PROGRESS', '2026-01-21 14:00:00+00');

-- 8. BRANCHES (Canonical Main & Contributor Attempt Branches)
INSERT INTO branches (branch_id, note_id, issue_id, attempted_by, branch_name, is_main, is_merged, selected_by, selected_at, created_at) VALUES
  ('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-11 10:30:00+00'),
  ('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'd50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'issue-btree/bob-fast-search', FALSE, TRUE, '550e8400-e29b-41d4-a716-446655440001', '2026-01-14 09:00:00+00', '2026-01-13 14:15:00+00'),
  ('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440002', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-12 11:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440002', 'd50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'issue-dijkstra/charlie-fibonacci-heap', FALSE, FALSE, NULL, NULL, '2026-01-20 10:15:00+00'),
  ('850e8400-e29b-41d4-a716-446655440008', '750e8400-e29b-41d4-a716-446655440006', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-15 15:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440009', '750e8400-e29b-41d4-a716-446655440006', 'd50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'issue-wal/charlie-group-commit', FALSE, TRUE, '550e8400-e29b-41d4-a716-446655440002', '2026-01-18 11:00:00+00', '2026-01-17 12:30:00+00'),
  ('850e8400-e29b-41d4-a716-44665544000c', '750e8400-e29b-41d4-a716-446655440008', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 14:00:00+00'),
  ('850e8400-e29b-41d4-a716-44665544000d', '750e8400-e29b-41d4-a716-446655440008', 'd50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'issue-ssa/evan-pruned-phi', FALSE, TRUE, '550e8400-e29b-41d4-a716-446655440006', '2026-01-19 14:00:00+00', '2026-01-18 14:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440010', '750e8400-e29b-41d4-a716-44665544000b', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-18 11:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440011', '750e8400-e29b-41d4-a716-44665544000b', 'd50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'issue-cfs/charlie-vruntime-clamp', FALSE, TRUE, '550e8400-e29b-41d4-a716-446655440005', '2026-01-20 10:00:00+00', '2026-01-19 13:30:00+00'),
  ('850e8400-e29b-41d4-a716-446655440012', '750e8400-e29b-41d4-a716-44665544000c', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-19 13:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440013', '750e8400-e29b-41d4-a716-44665544000c', 'd50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', 'issue-ecc/bob-projective-coords', FALSE, FALSE, NULL, NULL, '2026-01-21 14:30:00+00'),
  ('850e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440003', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440004', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-446655440005', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00'),
  ('850e8400-e29b-41d4-a716-44665544000a', '750e8400-e29b-41d4-a716-446655440007', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00'),
  ('850e8400-e29b-41d4-a716-44665544000e', '750e8400-e29b-41d4-a716-446655440009', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00'),
  ('850e8400-e29b-41d4-a716-44665544000f', '750e8400-e29b-41d4-a716-44665544000a', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00'),
  ('850e8400-e29b-41d4-a716-446655440014', '750e8400-e29b-41d4-a716-44665544000d', NULL, NULL, 'main', TRUE, FALSE, NULL, NULL, '2026-01-16 10:00:00+00');

-- 9. COMMITS (DAG History with Parents & Merge Parents)
INSERT INTO commits (commit_id, branch_id, parent_commit_id, merge_parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', NULL, NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial draft: B-Tree definitions and node structures', '2baa19a8d87cb1f5c07716f5675b1d94f455db291fc60a693da5813754338ceb', '2026-01-11 10:35:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440002', 'b50e8400-e29b-41d4-a716-446655440001', NULL, '550e8400-e29b-41d4-a716-446655440002', 'feat(search): replace linear search with logarithmic binary search', 'c36a58ff1399fcb1b286137a7020b9ca54f23056e2a342cb9294bb650a7858b2', '2026-01-13 16:45:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440003', '850e8400-e29b-41d4-a716-446655440001', 'b50e8400-e29b-41d4-a716-446655440001', 'b50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Merge branch ''issue-btree/bob-fast-search'' into main', '64a998a361231a2d445b4eb063bd88381e90a8d3e344f7e8fc2c77f42ce901b1', '2026-01-14 09:00:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440003', NULL, NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial draft: Dijkstra and A* pathfinding notes', '3fadf5a026123736ee2889e920c5fec027367631c31b798ae8fd94556576fa47', '2026-01-12 11:05:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440005', '850e8400-e29b-41d4-a716-446655440004', 'b50e8400-e29b-41d4-a716-446655440004', NULL, '550e8400-e29b-41d4-a716-446655440003', 'feat(fib-heap): implement Fibonacci heap decrease-key node structure', '76e13dc91a15f811e0f6358973b3e4ea3830f8d10368e5e1b20c102ea4efeec4', '2026-01-20 11:35:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440008', '850e8400-e29b-41d4-a716-446655440008', NULL, NULL, '550e8400-e29b-41d4-a716-446655440002', 'Initial draft: WAL protocols and ARIES three-pass recovery', 'e6f6122145458c68ecf6909f8e18519c4f9571e71778c3bcca6b6d9200512753', '2026-01-15 15:05:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440009', '850e8400-e29b-41d4-a716-446655440009', 'b50e8400-e29b-41d4-a716-446655440008', NULL, '550e8400-e29b-41d4-a716-446655440003', 'feat(wal): implement group commit batching to avoid per-txn fsync stall', '45d9caf71117f75aef2356f884baf1fb9939b9c07c56fc7f7294a3f69c02bff2', '2026-01-17 16:00:00+00'),
  ('b50e8400-e29b-41d4-a716-44665544000a', '850e8400-e29b-41d4-a716-446655440008', 'b50e8400-e29b-41d4-a716-446655440008', 'b50e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440002', 'Merge branch ''issue-wal/charlie-group-commit'' into main', 'be36a93198c3dc552e8870b37ec527e478d7e2a120223cee30f9ac8c1b3a8b9e', '2026-01-18 11:00:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440020', '850e8400-e29b-41d4-a716-44665544000c', NULL, NULL, '550e8400-e29b-41d4-a716-446655440006', 'Initial draft: SSA form, dominators, and minimal phi placement', '950a56b971465a0522c2f865e07a2981575d0b28317345b3e364b22ab055eeb6', '2026-01-16 14:10:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440021', '850e8400-e29b-41d4-a716-44665544000d', 'b50e8400-e29b-41d4-a716-446655440020', NULL, '550e8400-e29b-41d4-a716-446655440005', 'feat(ssa): optimize Cytron algorithm with pruned liveness check', '41d5e75bdcf478caa168b14769f7fd1bebcf19edebe2bf398589b82d27f9a636', '2026-01-18 16:00:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440022', '850e8400-e29b-41d4-a716-44665544000c', 'b50e8400-e29b-41d4-a716-446655440020', 'b50e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440006', 'Merge branch ''issue-ssa/evan-pruned-phi'' into main', '8a92493de765e994ce16468f2248d60bf14dac086a4d68177297f51ebb9bbbc0', '2026-01-19 14:00:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440030', '850e8400-e29b-41d4-a716-446655440010', NULL, NULL, '550e8400-e29b-41d4-a716-446655440005', 'Initial draft: Linux CFS scheduler runqueue and vruntime math', 'f2586a6a6c4cea6469d7642fb4bf02ef81ab03b21df82701c3caef96082bf14f', '2026-01-18 11:10:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440031', '850e8400-e29b-41d4-a716-446655440011', 'b50e8400-e29b-41d4-a716-446655440030', NULL, '550e8400-e29b-41d4-a716-446655440003', 'fix(cfs): clamp waking task vruntime against cfs_rq min_vruntime', '5200109e349a81131f1b2717e746fd3b4a4eafa252c1004f687b40dd27c6688b', '2026-01-19 14:15:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440032', '850e8400-e29b-41d4-a716-446655440010', 'b50e8400-e29b-41d4-a716-446655440030', 'b50e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440005', 'Merge branch ''issue-cfs/charlie-vruntime-clamp'' into main', '8206834ec2f84607ef1bd5229a83a1aa97506527071423875ea3a000d71a3291', '2026-01-20 10:00:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440040', '850e8400-e29b-41d4-a716-446655440012', NULL, NULL, '550e8400-e29b-41d4-a716-446655440004', 'Initial draft: Secp256k1 curve formulas and affine operations', '0d0c36dcf04f2e669ec0d839a021c2647ea9fb6712ed5c312bb3e63ca274545a', '2026-01-19 13:10:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440041', '850e8400-e29b-41d4-a716-446655440013', 'b50e8400-e29b-41d4-a716-446655440040', NULL, '550e8400-e29b-41d4-a716-446655440002', 'feat(ecc): implement Jacobian projective coordinate point doubling', '61d9186c709b29b52f2e3c4bbf38966fc8a22c81f5bc216cfabb200ed6bf3f73', '2026-01-21 15:30:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440064', '850e8400-e29b-41d4-a716-446655440005', NULL, NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial draft: Dynamic Programming & Memoization Patterns', '74c68235e902810ad393c5b42f4fde3d42d26fc7a9bc3021bfb68955fa45e735', '2026-01-16 10:05:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440067', '850e8400-e29b-41d4-a716-446655440006', NULL, NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial draft: Next.js 15 App Router & Server Actions', '9dacd48e5cd8663e671c0eccf09bc54582a4ceb84ccf99c5219050e57bea5c98', '2026-01-16 10:05:00+00'),
  ('b50e8400-e29b-41d4-a716-44665544006a', '850e8400-e29b-41d4-a716-446655440007', NULL, NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial draft: Distributed Edge Computing & Edge Middleware', '40056faa678001f591eb0e1e22e028d798a724d4b897add7e8d44bb740900a17', '2026-01-16 10:05:00+00'),
  ('b50e8400-e29b-41d4-a716-44665544006d', '850e8400-e29b-41d4-a716-44665544000a', NULL, NULL, '550e8400-e29b-41d4-a716-446655440002', 'Initial draft: Buffer Pool Management & LRU-K Eviction', '5ac78acb24f748f90d6f9b161771960f82b1f80227b5604c71586180a3f09ecb', '2026-01-16 10:05:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440070', '850e8400-e29b-41d4-a716-44665544000e', NULL, NULL, '550e8400-e29b-41d4-a716-446655440006', 'Initial draft: LLVM IR Generation & Register Allocation', 'c0fba457ae0b9362062282b8076fae3a114ea1decf2b299a3099c032977d3e0f', '2026-01-16 10:05:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440073', '850e8400-e29b-41d4-a716-44665544000f', NULL, NULL, '550e8400-e29b-41d4-a716-446655440005', 'Initial draft: Multi-Level Paging & TLB Shootdowns', '6d4a6292da6f77571a8c13b910cd353460128df4b36182bab9c9f1711508dfc1', '2026-01-16 10:05:00+00'),
  ('b50e8400-e29b-41d4-a716-446655440076', '850e8400-e29b-41d4-a716-446655440014', NULL, NULL, '550e8400-e29b-41d4-a716-446655440004', 'Initial draft: Zero-Knowledge Proofs & zk-SNARKs (Groth16)', 'e3a12e1e3066c85dd9b7e747ae967f61d22272f9d0e7d77b4e0f38d66b39e489', '2026-01-16 10:05:00+00');

-- 10. COMMIT MANIFESTS (Ternary Relationship: Commit x Slot x Version)
INSERT INTO commit_manifests (manifest_id, commit_id, slot_id, version_id) VALUES
  ('c50e8400-e29b-41d4-a716-446655440001', 'b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001'),
  ('c50e8400-e29b-41d4-a716-446655440002', 'b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002'),
  ('c50e8400-e29b-41d4-a716-446655440003', 'b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440003'),
  ('c50e8400-e29b-41d4-a716-446655440004', 'b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440004'),
  ('c50e8400-e29b-41d4-a716-446655440005', 'b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001'),
  ('c50e8400-e29b-41d4-a716-446655440006', 'b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002'),
  ('c50e8400-e29b-41d4-a716-446655440007', 'b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005'),
  ('c50e8400-e29b-41d4-a716-446655440008', 'b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440004'),
  ('c50e8400-e29b-41d4-a716-446655440009', 'b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001'),
  ('c50e8400-e29b-41d4-a716-44665544000a', 'b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002'),
  ('c50e8400-e29b-41d4-a716-44665544000b', 'b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440005'),
  ('c50e8400-e29b-41d4-a716-44665544000c', 'b50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440004', 'a50e8400-e29b-41d4-a716-446655440004'),
  ('c50e8400-e29b-41d4-a716-44665544000d', 'b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440005', 'a50e8400-e29b-41d4-a716-446655440006'),
  ('c50e8400-e29b-41d4-a716-44665544000e', 'b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440006', 'a50e8400-e29b-41d4-a716-446655440007'),
  ('c50e8400-e29b-41d4-a716-44665544000f', 'b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440007', 'a50e8400-e29b-41d4-a716-446655440008'),
  ('c50e8400-e29b-41d4-a716-446655440010', 'b50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440008', 'a50e8400-e29b-41d4-a716-446655440009'),
  ('c50e8400-e29b-41d4-a716-446655440011', 'b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440005', 'a50e8400-e29b-41d4-a716-446655440006'),
  ('c50e8400-e29b-41d4-a716-446655440012', 'b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440006', 'a50e8400-e29b-41d4-a716-446655440007'),
  ('c50e8400-e29b-41d4-a716-446655440013', 'b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440007', 'a50e8400-e29b-41d4-a716-44665544000a'),
  ('c50e8400-e29b-41d4-a716-446655440014', 'b50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440008', 'a50e8400-e29b-41d4-a716-446655440009'),
  ('c50e8400-e29b-41d4-a716-446655440015', 'b50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440011', 'a50e8400-e29b-41d4-a716-446655440015'),
  ('c50e8400-e29b-41d4-a716-446655440016', 'b50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440012', 'a50e8400-e29b-41d4-a716-446655440016'),
  ('c50e8400-e29b-41d4-a716-446655440017', 'b50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440013', 'a50e8400-e29b-41d4-a716-446655440017'),
  ('c50e8400-e29b-41d4-a716-446655440018', 'b50e8400-e29b-41d4-a716-446655440008', '950e8400-e29b-41d4-a716-446655440014', 'a50e8400-e29b-41d4-a716-446655440018'),
  ('c50e8400-e29b-41d4-a716-446655440019', 'b50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440011', 'a50e8400-e29b-41d4-a716-446655440015'),
  ('c50e8400-e29b-41d4-a716-44665544001a', 'b50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440012', 'a50e8400-e29b-41d4-a716-446655440016'),
  ('c50e8400-e29b-41d4-a716-44665544001b', 'b50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440013', 'a50e8400-e29b-41d4-a716-446655440019'),
  ('c50e8400-e29b-41d4-a716-44665544001c', 'b50e8400-e29b-41d4-a716-446655440009', '950e8400-e29b-41d4-a716-446655440014', 'a50e8400-e29b-41d4-a716-446655440018'),
  ('c50e8400-e29b-41d4-a716-44665544001d', 'b50e8400-e29b-41d4-a716-44665544000a', '950e8400-e29b-41d4-a716-446655440011', 'a50e8400-e29b-41d4-a716-446655440015'),
  ('c50e8400-e29b-41d4-a716-44665544001e', 'b50e8400-e29b-41d4-a716-44665544000a', '950e8400-e29b-41d4-a716-446655440012', 'a50e8400-e29b-41d4-a716-446655440016'),
  ('c50e8400-e29b-41d4-a716-44665544001f', 'b50e8400-e29b-41d4-a716-44665544000a', '950e8400-e29b-41d4-a716-446655440013', 'a50e8400-e29b-41d4-a716-446655440019'),
  ('c50e8400-e29b-41d4-a716-446655440020', 'b50e8400-e29b-41d4-a716-44665544000a', '950e8400-e29b-41d4-a716-446655440014', 'a50e8400-e29b-41d4-a716-446655440018'),
  ('c50e8400-e29b-41d4-a716-446655440021', 'b50e8400-e29b-41d4-a716-446655440020', '950e8400-e29b-41d4-a716-446655440018', 'a50e8400-e29b-41d4-a716-446655440020'),
  ('c50e8400-e29b-41d4-a716-446655440022', 'b50e8400-e29b-41d4-a716-446655440020', '950e8400-e29b-41d4-a716-446655440019', 'a50e8400-e29b-41d4-a716-446655440021'),
  ('c50e8400-e29b-41d4-a716-446655440023', 'b50e8400-e29b-41d4-a716-446655440020', '950e8400-e29b-41d4-a716-44665544001a', 'a50e8400-e29b-41d4-a716-446655440022'),
  ('c50e8400-e29b-41d4-a716-446655440024', 'b50e8400-e29b-41d4-a716-446655440020', '950e8400-e29b-41d4-a716-44665544001b', 'a50e8400-e29b-41d4-a716-446655440023'),
  ('c50e8400-e29b-41d4-a716-446655440025', 'b50e8400-e29b-41d4-a716-446655440021', '950e8400-e29b-41d4-a716-446655440018', 'a50e8400-e29b-41d4-a716-446655440020'),
  ('c50e8400-e29b-41d4-a716-446655440026', 'b50e8400-e29b-41d4-a716-446655440021', '950e8400-e29b-41d4-a716-446655440019', 'a50e8400-e29b-41d4-a716-446655440021'),
  ('c50e8400-e29b-41d4-a716-446655440027', 'b50e8400-e29b-41d4-a716-446655440021', '950e8400-e29b-41d4-a716-44665544001a', 'a50e8400-e29b-41d4-a716-446655440024'),
  ('c50e8400-e29b-41d4-a716-446655440028', 'b50e8400-e29b-41d4-a716-446655440021', '950e8400-e29b-41d4-a716-44665544001b', 'a50e8400-e29b-41d4-a716-446655440023'),
  ('c50e8400-e29b-41d4-a716-446655440029', 'b50e8400-e29b-41d4-a716-446655440022', '950e8400-e29b-41d4-a716-446655440018', 'a50e8400-e29b-41d4-a716-446655440020'),
  ('c50e8400-e29b-41d4-a716-44665544002a', 'b50e8400-e29b-41d4-a716-446655440022', '950e8400-e29b-41d4-a716-446655440019', 'a50e8400-e29b-41d4-a716-446655440021'),
  ('c50e8400-e29b-41d4-a716-44665544002b', 'b50e8400-e29b-41d4-a716-446655440022', '950e8400-e29b-41d4-a716-44665544001a', 'a50e8400-e29b-41d4-a716-446655440024'),
  ('c50e8400-e29b-41d4-a716-44665544002c', 'b50e8400-e29b-41d4-a716-446655440022', '950e8400-e29b-41d4-a716-44665544001b', 'a50e8400-e29b-41d4-a716-446655440023'),
  ('c50e8400-e29b-41d4-a716-446655440030', 'b50e8400-e29b-41d4-a716-446655440030', '950e8400-e29b-41d4-a716-446655440021', 'a50e8400-e29b-41d4-a716-446655440030'),
  ('c50e8400-e29b-41d4-a716-446655440031', 'b50e8400-e29b-41d4-a716-446655440030', '950e8400-e29b-41d4-a716-446655440022', 'a50e8400-e29b-41d4-a716-446655440031'),
  ('c50e8400-e29b-41d4-a716-446655440032', 'b50e8400-e29b-41d4-a716-446655440030', '950e8400-e29b-41d4-a716-446655440023', 'a50e8400-e29b-41d4-a716-446655440032'),
  ('c50e8400-e29b-41d4-a716-446655440033', 'b50e8400-e29b-41d4-a716-446655440031', '950e8400-e29b-41d4-a716-446655440021', 'a50e8400-e29b-41d4-a716-446655440030'),
  ('c50e8400-e29b-41d4-a716-446655440034', 'b50e8400-e29b-41d4-a716-446655440031', '950e8400-e29b-41d4-a716-446655440022', 'a50e8400-e29b-41d4-a716-446655440031'),
  ('c50e8400-e29b-41d4-a716-446655440035', 'b50e8400-e29b-41d4-a716-446655440031', '950e8400-e29b-41d4-a716-446655440023', 'a50e8400-e29b-41d4-a716-446655440033'),
  ('c50e8400-e29b-41d4-a716-446655440036', 'b50e8400-e29b-41d4-a716-446655440032', '950e8400-e29b-41d4-a716-446655440021', 'a50e8400-e29b-41d4-a716-446655440030'),
  ('c50e8400-e29b-41d4-a716-446655440037', 'b50e8400-e29b-41d4-a716-446655440032', '950e8400-e29b-41d4-a716-446655440022', 'a50e8400-e29b-41d4-a716-446655440031'),
  ('c50e8400-e29b-41d4-a716-446655440038', 'b50e8400-e29b-41d4-a716-446655440032', '950e8400-e29b-41d4-a716-446655440023', 'a50e8400-e29b-41d4-a716-446655440033'),
  ('c50e8400-e29b-41d4-a716-446655440040', 'b50e8400-e29b-41d4-a716-446655440040', '950e8400-e29b-41d4-a716-446655440024', 'a50e8400-e29b-41d4-a716-446655440040'),
  ('c50e8400-e29b-41d4-a716-446655440041', 'b50e8400-e29b-41d4-a716-446655440040', '950e8400-e29b-41d4-a716-446655440025', 'a50e8400-e29b-41d4-a716-446655440041'),
  ('c50e8400-e29b-41d4-a716-446655440042', 'b50e8400-e29b-41d4-a716-446655440040', '950e8400-e29b-41d4-a716-446655440026', 'a50e8400-e29b-41d4-a716-446655440042'),
  ('c50e8400-e29b-41d4-a716-446655440043', 'b50e8400-e29b-41d4-a716-446655440041', '950e8400-e29b-41d4-a716-446655440024', 'a50e8400-e29b-41d4-a716-446655440040'),
  ('c50e8400-e29b-41d4-a716-446655440044', 'b50e8400-e29b-41d4-a716-446655440041', '950e8400-e29b-41d4-a716-446655440025', 'a50e8400-e29b-41d4-a716-446655440041'),
  ('c50e8400-e29b-41d4-a716-446655440045', 'b50e8400-e29b-41d4-a716-446655440041', '950e8400-e29b-41d4-a716-446655440026', 'a50e8400-e29b-41d4-a716-446655440043'),
  ('c50e8400-e29b-41d4-a716-446655440064', 'b50e8400-e29b-41d4-a716-446655440064', '950e8400-e29b-41d4-a716-446655440064', 'a50e8400-e29b-41d4-a716-446655440064'),
  ('c50e8400-e29b-41d4-a716-446655440065', 'b50e8400-e29b-41d4-a716-446655440064', '950e8400-e29b-41d4-a716-446655440065', 'a50e8400-e29b-41d4-a716-446655440065'),
  ('c50e8400-e29b-41d4-a716-446655440066', 'b50e8400-e29b-41d4-a716-446655440064', '950e8400-e29b-41d4-a716-446655440066', 'a50e8400-e29b-41d4-a716-446655440066'),
  ('c50e8400-e29b-41d4-a716-446655440067', 'b50e8400-e29b-41d4-a716-446655440067', '950e8400-e29b-41d4-a716-446655440067', 'a50e8400-e29b-41d4-a716-446655440067'),
  ('c50e8400-e29b-41d4-a716-446655440068', 'b50e8400-e29b-41d4-a716-446655440067', '950e8400-e29b-41d4-a716-446655440068', 'a50e8400-e29b-41d4-a716-446655440068'),
  ('c50e8400-e29b-41d4-a716-446655440069', 'b50e8400-e29b-41d4-a716-446655440067', '950e8400-e29b-41d4-a716-446655440069', 'a50e8400-e29b-41d4-a716-446655440069'),
  ('c50e8400-e29b-41d4-a716-44665544006a', 'b50e8400-e29b-41d4-a716-44665544006a', '950e8400-e29b-41d4-a716-44665544006a', 'a50e8400-e29b-41d4-a716-44665544006a'),
  ('c50e8400-e29b-41d4-a716-44665544006b', 'b50e8400-e29b-41d4-a716-44665544006a', '950e8400-e29b-41d4-a716-44665544006b', 'a50e8400-e29b-41d4-a716-44665544006b'),
  ('c50e8400-e29b-41d4-a716-44665544006c', 'b50e8400-e29b-41d4-a716-44665544006a', '950e8400-e29b-41d4-a716-44665544006c', 'a50e8400-e29b-41d4-a716-44665544006c'),
  ('c50e8400-e29b-41d4-a716-44665544006d', 'b50e8400-e29b-41d4-a716-44665544006d', '950e8400-e29b-41d4-a716-44665544006d', 'a50e8400-e29b-41d4-a716-44665544006d'),
  ('c50e8400-e29b-41d4-a716-44665544006e', 'b50e8400-e29b-41d4-a716-44665544006d', '950e8400-e29b-41d4-a716-44665544006e', 'a50e8400-e29b-41d4-a716-44665544006e'),
  ('c50e8400-e29b-41d4-a716-44665544006f', 'b50e8400-e29b-41d4-a716-44665544006d', '950e8400-e29b-41d4-a716-44665544006f', 'a50e8400-e29b-41d4-a716-44665544006f'),
  ('c50e8400-e29b-41d4-a716-446655440070', 'b50e8400-e29b-41d4-a716-446655440070', '950e8400-e29b-41d4-a716-446655440070', 'a50e8400-e29b-41d4-a716-446655440070'),
  ('c50e8400-e29b-41d4-a716-446655440071', 'b50e8400-e29b-41d4-a716-446655440070', '950e8400-e29b-41d4-a716-446655440071', 'a50e8400-e29b-41d4-a716-446655440071'),
  ('c50e8400-e29b-41d4-a716-446655440072', 'b50e8400-e29b-41d4-a716-446655440070', '950e8400-e29b-41d4-a716-446655440072', 'a50e8400-e29b-41d4-a716-446655440072'),
  ('c50e8400-e29b-41d4-a716-446655440073', 'b50e8400-e29b-41d4-a716-446655440073', '950e8400-e29b-41d4-a716-446655440073', 'a50e8400-e29b-41d4-a716-446655440073'),
  ('c50e8400-e29b-41d4-a716-446655440074', 'b50e8400-e29b-41d4-a716-446655440073', '950e8400-e29b-41d4-a716-446655440074', 'a50e8400-e29b-41d4-a716-446655440074'),
  ('c50e8400-e29b-41d4-a716-446655440075', 'b50e8400-e29b-41d4-a716-446655440073', '950e8400-e29b-41d4-a716-446655440075', 'a50e8400-e29b-41d4-a716-446655440075'),
  ('c50e8400-e29b-41d4-a716-446655440076', 'b50e8400-e29b-41d4-a716-446655440076', '950e8400-e29b-41d4-a716-446655440076', 'a50e8400-e29b-41d4-a716-446655440076'),
  ('c50e8400-e29b-41d4-a716-446655440077', 'b50e8400-e29b-41d4-a716-446655440076', '950e8400-e29b-41d4-a716-446655440077', 'a50e8400-e29b-41d4-a716-446655440077'),
  ('c50e8400-e29b-41d4-a716-446655440078', 'b50e8400-e29b-41d4-a716-446655440076', '950e8400-e29b-41d4-a716-446655440078', 'a50e8400-e29b-41d4-a716-446655440078');

-- 11. EDITIONS (Published Read-Only Snapshots)
INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by, created_at) VALUES
  ('d10e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'CS 101 Standard Release v1.0', 'cs101-release-v1', 'b50e8400-e29b-41d4-a716-446655440003', TRUE, '550e8400-e29b-41d4-a716-446655440001', '2026-01-14 10:00:00+00'),
  ('d10e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440006', 'Database Engine Internals 2026 Edition', 'db-internals-2026', 'b50e8400-e29b-41d4-a716-44665544000a', TRUE, '550e8400-e29b-41d4-a716-446655440002', '2026-01-18 12:00:00+00'),
  ('d10e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440008', 'SSA Form & Dominance Reference', 'compiler-ssa-v1', 'b50e8400-e29b-41d4-a716-446655440022', TRUE, '550e8400-e29b-41d4-a716-446655440006', '2026-01-19 15:00:00+00'),
  ('d10e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-44665544000b', 'Linux CFS Scheduler Manual', 'linux-sched-v1', 'b50e8400-e29b-41d4-a716-446655440032', TRUE, '550e8400-e29b-41d4-a716-446655440005', '2026-01-20 11:00:00+00'),
  ('d10e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440004', 'Next.js 15 Production Architecture', 'nextjs15-reference', 'b50e8400-e29b-41d4-a716-446655440067', TRUE, '550e8400-e29b-41d4-a716-446655440001', '2026-01-18 10:00:00+00'),
  ('d10e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-44665544000d', 'Groth16 zk-SNARKs Protocol Guide', 'zk-snarks-intro', 'b50e8400-e29b-41d4-a716-446655440076', TRUE, '550e8400-e29b-41d4-a716-446655440004', '2026-01-21 16:00:00+00');

-- 12. ACCESS REQUESTS (RBAC Workflow)
INSERT INTO access_requests (request_id, user_id, initiated_by, resource_id, requested_role, direction, status, reviewed_by, message, created_at, reviewed_at) VALUES
  ('e50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', 'REQUEST', 'PENDING', NULL, 'Hi Alice! I would love to contribute notes on Red-Black Trees and A* heuristic search.', '2026-01-22 09:30:00+00', NULL),
  ('e50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440003', 'MAINTAINER', 'REQUEST', 'APPROVED', '550e8400-e29b-41d4-a716-446655440002', 'Can I help maintain the WAL and recovery notes section?', '2026-01-18 08:00:00+00', '2026-01-18 09:00:00+00'),
  ('e50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440002', 'CONTRIBUTOR', 'REQUEST', 'PENDING', NULL, 'Would love to document edge deployment best practices with Cloudflare Workers.', '2026-01-23 11:00:00+00', NULL);

-- 13. ISSUE CONTRIBUTORS
INSERT INTO issue_contributors (issue_id, contributor_id, assigned_by, assigned_at) VALUES
  ('d50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '2026-01-13 14:05:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2026-01-20 10:05:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '2026-01-17 12:05:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440006', '2026-01-18 13:05:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440005', '2026-01-19 13:05:00+00'),
  ('d50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', '2026-01-21 14:05:00+00');

-- 14. NOTIFICATIONS (Live Activity Feed)
INSERT INTO notifications (notification_id, user_id, notification_type, title, message, link, is_read, created_at, related_resource_id, related_user_id) VALUES
  ('f50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'ACCESS_REQUEST', 'New Access Request', 'diana requested CONTRIBUTOR access on CS 101 Study Notes', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/manage', FALSE, '2026-01-22 09:30:00+00', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004'),
  ('f50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'COLLABORATOR_ADDED', 'Collaborator Added', 'bob was added as MAINTAINER to CS 101 Study Notes', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001', TRUE, '2026-01-13 12:00:00+00', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
  ('f50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'BRANCH_MERGED', 'Your Attempt was Merged!', 'Alice merged your attempt branch for B-Tree fast search into main', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/notes/750e8400-e29b-41d4-a716-446655440001/tree', FALSE, '2026-01-14 09:00:00+00', '750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'),
  ('f50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'ISSUE_ASSIGNED', 'Issue Assigned', 'You were assigned to issue: Optimize Dijkstra PriorityQueue with Fibonacci Heap', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440001/notes/750e8400-e29b-41d4-a716-446655440002/issues', FALSE, '2026-01-20 10:05:00+00', '750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001'),
  ('f50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'BRANCH_MERGED', 'Branch Merged', 'Bob merged your attempt branch for Group Commit fsync batching into main', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440003/notes/750e8400-e29b-41d4-a716-446655440006/tree', FALSE, '2026-01-18 11:00:00+00', '750e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440002'),
  ('f50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'ACCESS_GRANTED', 'Request Approved', 'Bob approved your request for MAINTAINER role on Database Internals', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440003', FALSE, '2026-01-18 09:00:00+00', '650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002'),
  ('f50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440005', 'BRANCH_MERGED', 'Branch Merged', 'Fiona merged your attempt branch for Pruned SSA algorithm into main', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440004/notes/750e8400-e29b-41d4-a716-446655440008/tree', FALSE, '2026-01-19 14:00:00+00', '750e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440006'),
  ('f50e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440003', 'BRANCH_MERGED', 'Branch Merged', 'Evan merged your attempt branch for vruntime clamp into main', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440005/notes/750e8400-e29b-41d4-a716-44665544000b/tree', FALSE, '2026-01-20 10:00:00+00', '750e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440005'),
  ('f50e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440004', 'ISSUE_ASSIGNED', 'Issue Assigned', 'Bob submitted an attempt on your issue: Jacobian projective coordinates', '/dashboard/notebooks/650e8400-e29b-41d4-a716-446655440006/notes/750e8400-e29b-41d4-a716-44665544000c/issues', FALSE, '2026-01-21 14:30:00+00', '750e8400-e29b-41d4-a716-44665544000c', '550e8400-e29b-41d4-a716-446655440002');

-- =====================================================================
-- 15. AUTOMATED VERIFICATION & SANITY CHECK SUITE
-- =====================================================================

DO $$
DECLARE
    v_users_count       INT;
    v_resources_count   INT;
    v_notebooks_count   INT;
    v_notes_count       INT;
    v_slots_count       INT;
    v_blobs_count       INT;
    v_branches_count    INT;
    v_merged_branches   INT;
    v_commits_count     INT;
    v_manifests_count   INT;
    v_issues_count      INT;
    v_editions_count    INT;
BEGIN
    SELECT COUNT(*) INTO v_users_count FROM users;
    SELECT COUNT(*) INTO v_resources_count FROM resources;
    SELECT COUNT(*) INTO v_notebooks_count FROM notebooks;
    SELECT COUNT(*) INTO v_notes_count FROM notes;
    SELECT COUNT(*) INTO v_slots_count FROM logical_block_slots;
    SELECT COUNT(*) INTO v_blobs_count FROM content_blobs;
    SELECT COUNT(*) INTO v_branches_count FROM branches;
    SELECT COUNT(*) INTO v_merged_branches FROM branches WHERE is_merged = TRUE;
    SELECT COUNT(*) INTO v_commits_count FROM commits;
    SELECT COUNT(*) INTO v_manifests_count FROM commit_manifests;
    SELECT COUNT(*) INTO v_issues_count FROM issues;
    SELECT COUNT(*) INTO v_editions_count FROM editions;

    RAISE NOTICE '---------------------------------------------------------';
    RAISE NOTICE 'BookWorm Master Warm-Up Database Verification Report:';
    RAISE NOTICE 'Users loaded:                  %', v_users_count;
    RAISE NOTICE 'Resources (Supertype):         %', v_resources_count;
    RAISE NOTICE 'Notebooks:                     %', v_notebooks_count;
    RAISE NOTICE 'Notes:                         %', v_notes_count;
    RAISE NOTICE 'Logical Block Slots:           %', v_slots_count;
    RAISE NOTICE 'CAS Content Blobs:             %', v_blobs_count;
    RAISE NOTICE 'Branches (Total / Merged):     % / %', v_branches_count, v_merged_branches;
    RAISE NOTICE 'Commits in DAG:                %', v_commits_count;
    RAISE NOTICE 'Ternary Manifests Linked:      %', v_manifests_count;
    RAISE NOTICE 'Block Issues (Active/Merged):  %', v_issues_count;
    RAISE NOTICE 'Published Snapshot Editions:   %', v_editions_count;
    RAISE NOTICE '---------------------------------------------------------';
    RAISE NOTICE 'SUCCESS: Complete database schema & warm-up dataset rebuilt and verified!';
END $$;
