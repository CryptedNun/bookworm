-- =====================================================================
-- BANGLADESH UNIVERSITY OF ENGINEERING AND TECHNOLOGY (BUET)
-- Department of Computer Science and Engineering
-- CSE 216 — Database Sessional Course Project
--
-- PROJECT: BookWorm — Git-like Version Control for Structured Notes
--
-- FILE: clean_schema.sql
-- PURPOSE: Master Clean Database Schema (DDL Only)
--          Includes Teardown, 18 Tables, Integrity Constraints,
--          Statistical Functions, Consistency Triggers, Stored Procedures,
--          and B-Tree / Partial Indexes (Zero Seed Data).
--
-- HOW TO INITIALIZE / RESET DDL:
-- Run in terminal:
--   psql "$DATABASE_URL" -f clean_schema.sql
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
DROP FUNCTION IF EXISTS calculate_user_contribution_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_note_storage_stats(UUID) CASCADE;
DROP PROCEDURE IF EXISTS merge_issue_branch(UUID, UUID, TEXT) CASCADE;
DROP PROCEDURE IF EXISTS fork_note_zero_cost(UUID, UUID, UUID, TEXT, UUID) CASCADE;

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
-- COMPUTED & STATISTICAL FUNCTIONS (Scalar & Table-Valued Analytics)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Function 1: calculate_user_contribution_score
-- Purpose: Returns a composite collaborative reputation score (integer)
--          analogous to an academic h-index, calculated dynamically from:
--          - Merged attempt branches (50 pts)
--          - Authored commits (10 pts)
--          - Issues created (15 pts)
--          - Review comments submitted (5 pts)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_user_contribution_score(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_commits_count     INT := 0;
    v_merged_branches   INT := 0;
    v_issues_created    INT := 0;
    v_comments_count    INT := 0;
    v_score             INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_commits_count
      FROM commits
     WHERE author_id = p_user_id;

    SELECT COUNT(*) INTO v_merged_branches
      FROM branches
     WHERE attempted_by = p_user_id
       AND is_merged = TRUE;

    SELECT COUNT(*) INTO v_issues_created
      FROM issues
     WHERE creator_id = p_user_id;

    SELECT COUNT(*) INTO v_comments_count
      FROM issue_comments
     WHERE author_id = p_user_id;

    v_score := (v_merged_branches * 50) + (v_commits_count * 10) + (v_issues_created * 15) + (v_comments_count * 5);
    RETURN v_score;
END;
$$;

-- ---------------------------------------------------------------------
-- Function 2: get_note_storage_stats
-- Purpose: Computes exact Content-Addressed Storage (CAS) deduplication
--          efficiency for a note across all historical commits and slots.
--          Returns a statistical table row:
--          (total_slots, total_commits, raw_content_bytes,
--           cas_stored_bytes, bytes_saved, dedup_ratio_percent)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_note_storage_stats(p_note_id UUID)
RETURNS TABLE (
    total_slots          INT,
    total_commits        INT,
    raw_content_bytes    BIGINT,
    cas_stored_bytes     BIGINT,
    bytes_saved          BIGINT,
    dedup_ratio_percent  NUMERIC(5,2)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_slots_count        INT := 0;
    v_commits_count      INT := 0;
    v_raw_bytes          BIGINT := 0;
    v_cas_bytes          BIGINT := 0;
    v_saved_bytes        BIGINT := 0;
    v_ratio              NUMERIC(5,2) := 0.00;
BEGIN
    SELECT COUNT(*) INTO v_slots_count
      FROM logical_block_slots
     WHERE note_id = p_note_id;

    SELECT COUNT(c.commit_id) INTO v_commits_count
      FROM commits c
      JOIN branches b ON b.branch_id = c.branch_id
     WHERE b.note_id = p_note_id;

    SELECT COALESCE(SUM(cb.byte_size), 0) INTO v_raw_bytes
      FROM branches b
      JOIN commits c ON c.branch_id = b.branch_id
      JOIN commit_manifests cm ON cm.commit_id = c.commit_id
      JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
      JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
     WHERE b.note_id = p_note_id;

    SELECT COALESCE(SUM(cb.byte_size), 0) INTO v_cas_bytes
      FROM content_blobs cb
     WHERE cb.sha256 IN (
         SELECT DISTINCT bvc.content_blob_hash
           FROM logical_block_slots s
           JOIN block_version_contents bvc ON bvc.slot_id = s.slot_id
          WHERE s.note_id = p_note_id
     );

    v_saved_bytes := GREATEST(v_raw_bytes - v_cas_bytes, 0);

    IF v_raw_bytes > 0 THEN
        v_ratio := ROUND(((v_saved_bytes::NUMERIC / v_raw_bytes::NUMERIC) * 100), 2);
    ELSE
        v_ratio := 0.00;
    END IF;

    RETURN QUERY SELECT
        v_slots_count,
        v_commits_count,
        v_raw_bytes,
        v_cas_bytes,
        v_saved_bytes,
        v_ratio;
END;
$$;

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
-- STORED PROCEDURES (Atomic Multi-Table Business Workflows)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Procedure 1: merge_issue_branch
-- Purpose: Atomically merges a contributor's issue-attempt branch into
--          the main branch of a note. Creates a 3-way merge commit,
--          reconstructs the commit_manifests ternary mapping, marks the
--          branch merged (firing the issue sync trigger), and dispatches
--          an audit notification.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE merge_issue_branch(
    p_branch_id        UUID,
    p_merger_user_id   UUID,
    p_commit_message   TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_note_id               UUID;
    v_issue_id              UUID;
    v_attempted_by          UUID;
    v_branch_name           TEXT;
    v_main_branch_id        UUID;
    v_main_head_commit_id   UUID;
    v_branch_head_commit_id UUID;
    v_new_commit_id         UUID;
    v_new_commit_hash       TEXT;
    v_effective_msg         TEXT;
    v_target_slot_id        UUID;
    v_issue_title           TEXT;
BEGIN
    -- 1. Validate branch exists, is not main, and is not already merged
    SELECT b.note_id, b.issue_id, b.attempted_by, b.branch_name, i.target_slot_id, i.title
      INTO v_note_id, v_issue_id, v_attempted_by, v_branch_name, v_target_slot_id, v_issue_title
      FROM branches b
      JOIN issues i ON i.issue_id = b.issue_id
     WHERE b.branch_id = p_branch_id
       AND b.is_main = FALSE
       AND b.is_merged = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Branch % is invalid, is a main branch, or has already been merged.', p_branch_id;
    END IF;

    -- 2. Verify merger user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_merger_user_id) THEN
        RAISE EXCEPTION 'Merger user % does not exist.', p_merger_user_id;
    END IF;

    -- 3. Locate the single main branch for this note
    SELECT branch_id INTO v_main_branch_id
      FROM branches
     WHERE note_id = v_note_id AND is_main = TRUE;

    IF v_main_branch_id IS NULL THEN
        RAISE EXCEPTION 'Corrupt note state: Note % has no main branch.', v_note_id;
    END IF;

    -- 4. Locate latest commit on main branch (Main HEAD)
    SELECT commit_id INTO v_main_head_commit_id
      FROM commits
     WHERE branch_id = v_main_branch_id
     ORDER BY created_at DESC
     LIMIT 1;

    -- 5. Locate latest commit on attempt branch (Attempt HEAD)
    SELECT commit_id INTO v_branch_head_commit_id
      FROM commits
     WHERE branch_id = p_branch_id
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_branch_head_commit_id IS NULL THEN
        RAISE EXCEPTION 'Cannot merge: Branch % contains zero commits.', p_branch_id;
    END IF;

    -- 6. Format commit message & generate cryptographic commit hash (SHA-256)
    v_effective_msg := COALESCE(p_commit_message, 'Merge branch ''' || v_branch_name || ''' into main');
    v_new_commit_id := gen_random_uuid();
    v_new_commit_hash := encode(digest(
        v_main_branch_id::text || ':' ||
        COALESCE(v_main_head_commit_id::text, 'ROOT') || ':' ||
        v_branch_head_commit_id::text || ':' ||
        clock_timestamp()::text || ':' ||
        v_effective_msg,
        'sha256'
    ), 'hex');

    -- 7. Insert the merge commit on the main branch
    INSERT INTO commits (
        commit_id,
        branch_id,
        parent_commit_id,
        merge_parent_commit_id,
        author_id,
        commit_message,
        commit_hash,
        created_at
    ) VALUES (
        v_new_commit_id,
        v_main_branch_id,
        v_main_head_commit_id,
        v_branch_head_commit_id,
        p_merger_user_id,
        v_effective_msg,
        v_new_commit_hash,
        now()
    );

    -- 8. Build and insert the ternary commit_manifests for the new merge commit
    -- All slots retain their version from Main HEAD, except the updated branch slot.
    INSERT INTO commit_manifests (manifest_id, commit_id, slot_id, version_id)
    SELECT
        gen_random_uuid(),
        v_new_commit_id,
        s.slot_id,
        COALESCE(branch_m.version_id, main_m.version_id) AS version_id
    FROM logical_block_slots s
    LEFT JOIN commit_manifests branch_m
           ON branch_m.commit_id = v_branch_head_commit_id
          AND branch_m.slot_id = s.slot_id
    LEFT JOIN commit_manifests main_m
           ON main_m.commit_id = v_main_head_commit_id
          AND main_m.slot_id = s.slot_id
    WHERE s.note_id = v_note_id
      AND COALESCE(branch_m.version_id, main_m.version_id) IS NOT NULL;

    -- 9. Mark attempt branch as merged and record winning selector
    UPDATE branches
       SET is_merged   = TRUE,
           selected_by = p_merger_user_id,
           selected_at = now()
     WHERE branch_id   = p_branch_id;
    -- Note: trg_branch_merge_updates_issue automatically fires and updates issues.status = 'MERGED'

    -- 10. Generate system notification for the branch contributor
    IF v_attempted_by IS NOT NULL AND v_attempted_by <> p_merger_user_id THEN
        INSERT INTO notifications (
            user_id,
            notification_type,
            title,
            message,
            link,
            related_resource_id,
            related_user_id
        ) VALUES (
            v_attempted_by,
            'BRANCH_MERGED',
            'Your branch was merged!',
            'Your changes on branch ''' || v_branch_name || ''' were selected and merged into main.',
            '/dashboard/notes/' || v_note_id::text,
            v_note_id,
            p_merger_user_id
        );
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Procedure 2: fork_note_zero_cost
-- Purpose: Clones an entire note into a destination notebook utilizing
--          Content-Addressed Storage (CAS) zero-duplication principles.
--          Creates a new note ISA subtype, clones logical slots, creates
--          an initial commit, and maps existing block versions directly.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE fork_note_zero_cost(
    p_source_note_id    UUID,
    p_dest_notebook_id  UUID,
    p_user_id           UUID,
    p_new_title         TEXT,
    INOUT p_forked_note_id UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_source_main_branch_id UUID;
    v_source_head_commit_id UUID;
    v_new_note_id           UUID;
    v_new_main_branch_id    UUID;
    v_new_commit_id         UUID;
    v_new_commit_hash       TEXT;
BEGIN
    -- 1. Validate destination notebook exists and user exists
    IF NOT EXISTS (SELECT 1 FROM notebooks WHERE notebook_id = p_dest_notebook_id) THEN
        RAISE EXCEPTION 'Destination notebook % does not exist.', p_dest_notebook_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'User % does not exist.', p_user_id;
    END IF;

    -- 2. Verify source note has a valid main branch and HEAD commit
    SELECT branch_id INTO v_source_main_branch_id
      FROM branches
     WHERE note_id = p_source_note_id AND is_main = TRUE;

    IF v_source_main_branch_id IS NULL THEN
        RAISE EXCEPTION 'Source note % has no active main branch.', p_source_note_id;
    END IF;

    SELECT commit_id INTO v_source_head_commit_id
      FROM commits
     WHERE branch_id = v_source_main_branch_id
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_source_head_commit_id IS NULL THEN
        RAISE EXCEPTION 'Source note % contains zero commits.', p_source_note_id;
    END IF;

    -- 3. Create ISA resource for the new note
    v_new_note_id := gen_random_uuid();
    INSERT INTO resources (resource_id, resource_type, created_at)
    VALUES (v_new_note_id, 'NOTE', now());

    -- 4. Insert into notes referencing the parent note (forked_from_note_id)
    INSERT INTO notes (
        note_id,
        notebook_id,
        title,
        forked_from_note_id,
        visibility
    ) VALUES (
        v_new_note_id,
        p_dest_notebook_id,
        p_new_title,
        p_source_note_id,
        'PRIVATE'
    );

    -- 5. Assign OWNER role to the user on the newly forked note
    INSERT INTO collaborator_roles (
        user_id,
        resource_id,
        role_type,
        granted_by
    ) VALUES (
        p_user_id,
        v_new_note_id,
        'OWNER',
        p_user_id
    );

    -- 6. Create main branch for the newly forked note
    v_new_main_branch_id := gen_random_uuid();
    INSERT INTO branches (
        branch_id,
        note_id,
        branch_name,
        is_main,
        created_at
    ) VALUES (
        v_new_main_branch_id,
        v_new_note_id,
        'main',
        TRUE,
        now()
    );

    -- 7. Deep-copy logical block slots (assigning fresh slot_ids for the new note)
    CREATE TEMP TABLE tmp_slot_map ON COMMIT DROP AS
    SELECT 
        s.slot_id AS old_slot_id,
        gen_random_uuid() AS new_slot_id,
        s.lexorank_key,
        s.block_type
    FROM logical_block_slots s
    WHERE s.note_id = p_source_note_id;

    INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type)
    SELECT new_slot_id, v_new_note_id, lexorank_key, block_type
    FROM tmp_slot_map;

    -- 8. Create new initial commit on forked note's main branch
    v_new_commit_id := gen_random_uuid();
    v_new_commit_hash := encode(digest(
        v_new_main_branch_id::text || ':' ||
        v_source_head_commit_id::text || ':' ||
        clock_timestamp()::text || ':' ||
        'Forked from note ' || p_source_note_id::text,
        'sha256'
    ), 'hex');

    INSERT INTO commits (
        commit_id,
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash,
        created_at
    ) VALUES (
        v_new_commit_id,
        v_new_main_branch_id,
        NULL,
        p_user_id,
        'Forked from note ' || p_source_note_id::text,
        v_new_commit_hash,
        now()
    );

    -- 9. Re-use existing immutable block version contents & content blobs! (Zero-cost CAS sharing)
    INSERT INTO commit_manifests (manifest_id, commit_id, slot_id, version_id)
    SELECT
        gen_random_uuid(),
        v_new_commit_id,
        m.new_slot_id,
        cm.version_id
    FROM tmp_slot_map m
    JOIN commit_manifests cm ON cm.slot_id = m.old_slot_id
    WHERE cm.commit_id = v_source_head_commit_id;

    -- 10. Return new note ID to caller
    p_forked_note_id := v_new_note_id;
END;
$$;

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

