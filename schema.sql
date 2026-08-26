-- =====================================================================
-- NoteHub — Neon (Postgres) schema — audited revision
-- Matches the reviewed & corrected Chen-notation ERD.
-- Run top to bottom on a fresh database (respects FK dependency order).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gives us gen_random_uuid()

-- =====================================================================
-- AREA 1 — USERS & PERMISSIONS
-- =====================================================================

CREATE TABLE users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    username    TEXT NOT NULL UNIQUE,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Deleting a user is intentionally NOT the normal path (every *_by / author_id /
    -- owner_id FK below stays RESTRICT-by-default): deactivate via is_active instead.
    -- This keeps history attribution intact without needing ON DELETE SET NULL
    -- everywhere, and it's why no FK to users carries an explicit ON DELETE clause.
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ISA supertype for notebooks/notes: every permission target is a "resource",
-- regardless of which subtype it actually is (disjoint, total specialization).
CREATE TABLE resources (
    resource_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   TEXT NOT NULL CHECK (resource_type IN ('NOTEBOOK', 'NOTE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_type ON resources (resource_type);

-- =====================================================================
-- AREA 2 — ORGANIZING CONTENT
-- =====================================================================

-- Shared-key ISA subtype: notebook_id IS resource_id, not an independent
-- surrogate key.
CREATE TABLE notebooks (
    notebook_id UUID PRIMARY KEY REFERENCES resources(resource_id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL REFERENCES users(user_id),
    title       TEXT NOT NULL,
    description TEXT,
    -- Soft delete: normal "delete notebook" sets this instead of a hard DELETE.
    -- See the note on `notes.deleted_at` below for why — the same reasoning applies.
    deleted_at  TIMESTAMPTZ,
    visibility  TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC'))
);

CREATE TABLE notes (
    note_id             UUID PRIMARY KEY REFERENCES resources(resource_id) ON DELETE CASCADE,
    -- CASCADE: deleting a notebook (the rare hard-delete/admin path) takes its notes
    -- with it. In practice this will still fail once a note has any commit history
    -- (see the commits/manifests section below) — which is correct: this system's
    -- history is meant to be immutable, so it should NOT be possible to silently
    -- cascade-delete years of version history via a single DELETE statement. The
    -- normal user-facing "delete" action is `deleted_at` below, not a hard DELETE.
    notebook_id         UUID NOT NULL REFERENCES notebooks(notebook_id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    -- SET NULL, not RESTRICT/CASCADE: if an original note is ever hard-deleted, its
    -- forks are independent content (separate slots, separate blob references) and
    -- must survive — they just lose the "forked from" pointer.
    forked_from_note_id UUID REFERENCES notes(note_id) ON DELETE SET NULL,
    -- FK to editions added later via ALTER TABLE — editions doesn't exist yet, and
    -- this is exactly the circular dependency the review flagged and fixed.
    default_edition_id  UUID,
    display_order       INT NOT NULL DEFAULT 0,
    deleted_at           TIMESTAMPTZ,
    visibility          TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC'))
);

-- =====================================================================
-- AREA 3 — THE CONTENT ITSELF (structure / versions / storage)
-- =====================================================================

-- Layer 3: content-addressed storage. Identical text is stored exactly once,
-- system-wide, regardless of which note or user it came from. Deliberately no
-- ON DELETE anywhere points AT this table with CASCADE — blobs are shared
-- across notes and forks, so they can only be safely removed by a separate
-- garbage-collection sweep ("is this hash referenced by zero versions?"),
-- never by a cascading DELETE from one note.
CREATE TABLE content_blobs (
    sha256          CHAR(64) PRIMARY KEY,
    content_text    TEXT NOT NULL,
    byte_size       INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Layer 1: structure — WHERE a block sits, independent of its content.
CREATE TABLE logical_block_slots (
    slot_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    parent_slot_id  UUID REFERENCES logical_block_slots(slot_id) ON DELETE CASCADE,
    lexorank_key    TEXT NOT NULL,
    -- Deliberately NO CHECK constraint here, unlike every other enum-like column
    -- in this schema. block_type is an extensible, plugin-style vocabulary (new
    -- block kinds should not require a migration); resource_type / role_type /
    -- status / direction / visibility below are a small, fixed, core-business
    -- vocabulary and DO get CHECK constraints. The asymmetry is intentional.
    block_type      TEXT NOT NULL,
    -- Composite unique so commit_manifests can enforce, via a real FK rather than
    -- a trigger, that a manifest's slot_id actually matches the note it's for.
    UNIQUE (note_id, slot_id)
);

-- Layer 2: versions — WHO wrote WHAT, for a given slot, and WHEN.
CREATE TABLE block_version_contents (
    version_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id             UUID NOT NULL REFERENCES logical_block_slots(slot_id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES users(user_id),
    content_blob_hash   CHAR(64) NOT NULL REFERENCES content_blobs(sha256),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Composite unique so commit_manifests can enforce, via a real FK, that the
    -- version it points at genuinely belongs to the slot it claims — without this,
    -- nothing stops a manifest row from pairing a slot with a version that
    -- actually belongs to a completely different slot. Caught by testing, fixed
    -- structurally rather than with a trigger.
    UNIQUE (slot_id, version_id)
);

-- =====================================================================
-- AREA 4 — WORKING TOGETHER
-- =====================================================================

CREATE TABLE issues (
    issue_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    -- Composite FK below (not a plain REFERENCES) — see logical_block_slots.
    target_slot_id  UUID NOT NULL,
    creator_id      UUID NOT NULL REFERENCES users(user_id),
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'MERGED', 'CLOSED')),
    -- Enforces "the targeted slot actually belongs to this issue's note" —
    -- without this, an issue could reference a slot that lives on a different
    -- note entirely. Confirmed as a real, silently-accepted bug during testing.
    FOREIGN KEY (note_id, target_slot_id) REFERENCES logical_block_slots (note_id, slot_id) ON DELETE CASCADE,
    -- Composite unique so branches can enforce "this attempt's note matches its issue's note".
    UNIQUE (note_id, issue_id)
);

-- Business rule (not a structural cardinality): a slot may have many issues
-- over its lifetime, but never more than one ACTIVE one at a time.
CREATE UNIQUE INDEX uq_one_active_issue_per_slot
    ON issues (target_slot_id)
    WHERE status IN ('OPEN', 'IN_PROGRESS');

-- =====================================================================
-- AREA 2 (cont'd) — BRANCHES
-- An issue is a permission to attempt a fix, not a single branch: several
-- contributors/maintainers can each open their own branch for one issue
-- (Has Attempts, 1:N). Each branch has exactly one worker (Attempted By).
-- The main branch (is_main) never attaches to an issue at all.
-- =====================================================================

CREATE TABLE branches (
    branch_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    issue_id        UUID,                              -- NULL only for the main branch
    attempted_by    UUID REFERENCES users(user_id),     -- NULL only for the main branch
    branch_name     TEXT NOT NULL,
    is_main         BOOLEAN NOT NULL DEFAULT FALSE,
    is_merged       BOOLEAN NOT NULL DEFAULT FALSE,
    -- "Resolved By" (Issue, Branch, User): who picked this branch as the winning
    -- attempt, and when. Collapses cleanly onto branches because a branch already
    -- belongs to exactly one issue via issue_id.
    selected_by     UUID REFERENCES users(user_id),
    selected_at     TIMESTAMPTZ,

    -- Enforces "this attempt's note matches its issue's note" — a NULL issue_id
    -- (the main branch) trivially satisfies a composite FK, so this only
    -- constrains real attempt branches.
    FOREIGN KEY (note_id, issue_id) REFERENCES issues (note_id, issue_id) ON DELETE CASCADE,

    -- Tightened from round 2: the main branch must be entirely unattempted —
    -- no issue, no worker, never merged, never selected. An attempt branch must
    -- have both an issue and a single worker. Caught by testing: the original
    -- version let the main branch be marked is_merged = TRUE, which is nonsensical
    -- (main is the merge target, not something that gets merged into itself).
    CONSTRAINT chk_main_xor_attempt CHECK (
        (is_main = TRUE  AND issue_id IS NULL     AND attempted_by IS NULL
                          AND is_merged = FALSE    AND selected_by IS NULL)
        OR
        (is_main = FALSE AND issue_id IS NOT NULL AND attempted_by IS NOT NULL)
    ),
    CONSTRAINT chk_selection_pair CHECK (
        (selected_by IS NULL) = (selected_at IS NULL)
    ),
    -- Biconditional: is_merged is true exactly when a selection has been
    -- recorded. Caught by testing: the original schema allowed is_merged = TRUE
    -- with selected_by left NULL, an inconsistent state.
    CONSTRAINT chk_merge_requires_selection CHECK (
        is_merged = (selected_by IS NOT NULL)
    )
);

-- At most one branch per note may be the main branch.
CREATE UNIQUE INDEX uq_one_main_branch_per_note
    ON branches (note_id)
    WHERE is_main = TRUE;

-- At most one branch per issue may end up selected/merged as the winner.
CREATE UNIQUE INDEX uq_one_selected_branch_per_issue
    ON branches (issue_id)
    WHERE is_merged = TRUE;

-- =====================================================================
-- AREA 5 — TRACKING CHANGES
-- =====================================================================

-- Single-parent commit chain (deliberate — see schema notes at the bottom):
-- merging here is a squash-style copy, one new commit on main with ONE
-- parent, not a true two-parent git merge.
--
-- No ON DELETE CASCADE points at this table from branches/notes, and this
-- table's own FKs (branch_id, parent_commit_id) carry no ON DELETE either —
-- commits are meant to be permanent, append-only history. This is also what
-- makes hard-deleting a note with any activity fail by design: the DELETE
-- will hit this table (or commit_manifests / editions below) and roll back.
CREATE TABLE commits (
    commit_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           UUID NOT NULL REFERENCES branches(branch_id),
    parent_commit_id    UUID REFERENCES commits(commit_id),
    author_id           UUID NOT NULL REFERENCES users(user_id),
    commit_message      TEXT,
    commit_hash         TEXT NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ternary fact (Commit, Slot, Version) — a real associative entity because it
-- carries its own surrogate key. Every commit stores a FULL manifest (one row
-- per slot, even unchanged ones) so reading any commit is a single flat query
-- instead of a diff-walk.
CREATE TABLE commit_manifests (
    manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commit_id   UUID NOT NULL REFERENCES commits(commit_id),
    slot_id     UUID NOT NULL,
    version_id  UUID NOT NULL,
    UNIQUE (commit_id, slot_id),   -- exactly one version per (commit, slot)
    -- Composite FK, not two independent ones: enforces that version_id genuinely
    -- belongs to slot_id. Confirmed as a real bug during testing — with two plain
    -- FKs, nothing stopped a manifest row from pairing a slot with a version that
    -- actually belongs to an entirely different slot.
    FOREIGN KEY (slot_id, version_id) REFERENCES block_version_contents (slot_id, version_id)
);

-- =====================================================================
-- AREA 2 (cont'd) — EDITIONS
-- =====================================================================

CREATE TABLE editions (
    edition_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id             UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    edition_name        TEXT NOT NULL,
    share_code          TEXT NOT NULL UNIQUE,
    -- No ON DELETE: never allow deleting a commit that a published edition
    -- still points at. This is one of the walls that makes hard-deleting
    -- history-bearing notes fail by design (see commits, above).
    pinned_commit_id    UUID NOT NULL REFERENCES commits(commit_id),
    is_standard         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by          UUID NOT NULL REFERENCES users(user_id)
);

-- Close the deferred FK now that editions exists. App-level rule: insert the
-- note first (default_edition_id stays NULL), then the first edition, THEN
-- backfill this column — never insert both rows in the same statement.
-- SET NULL (not RESTRICT): if an edition is ever administratively removed,
-- the note should simply lose its default pointer, not become undeletable.
ALTER TABLE notes
    ADD CONSTRAINT fk_notes_default_edition
    FOREIGN KEY (default_edition_id) REFERENCES editions(edition_id) ON DELETE SET NULL;

-- =====================================================================
-- AREA 1 (cont'd) — PERMISSIONS TABLES THAT REFERENCE RESOURCES
-- =====================================================================

CREATE TABLE collaborator_roles (
    role_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id),
    resource_id     UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    role_type       TEXT NOT NULL CHECK (role_type IN ('OWNER', 'MAINTAINER', 'CONTRIBUTOR')),
    capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb,
    granted_by      UUID NOT NULL REFERENCES users(user_id),
    UNIQUE (user_id, resource_id)   -- one role per user per resource
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

    -- REQUEST = "let me in", so the requester must be initiating for themselves.
    -- INVITE = "come join us", so the inviter must be someone other than the
    -- invitee. Caught by testing: without this, a REQUEST could be filed by one
    -- user naming a completely different user as its subject.
    CONSTRAINT chk_request_direction_consistency CHECK (
        (direction = 'REQUEST' AND initiated_by = user_id)
        OR
        (direction = 'INVITE'  AND initiated_by <> user_id)
    ),
    -- reviewed_by is set exactly when the request has actually been reviewed
    -- (APPROVED/REJECTED) — never while PENDING, never for a self-CANCELLED one.
    CONSTRAINT chk_review_matches_status CHECK (
        (status IN ('APPROVED', 'REJECTED')) = (reviewed_by IS NOT NULL)
    ),
    -- For a REQUEST, the reviewer must be someone other than the requester —
    -- you can't approve your own join request. Caught by testing: the original
    -- schema let a user set reviewed_by = their own user_id. INVITE is exempt on
    -- purpose: the invitee accepting/declining their own invite IS the reviewer.
    CONSTRAINT chk_reviewer_not_self_request CHECK (
        direction = 'INVITE' OR reviewed_by IS DISTINCT FROM user_id
    )
);

-- =====================================================================
-- AREA 4 (cont'd) — ISSUE_CONTRIBUTORS
-- Associative entity: composite key is structural (the two identifying
-- relationships below), so there's no separate "id" or text column for it.
-- =====================================================================

CREATE TABLE issue_contributors (
    issue_id        UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
    contributor_id  UUID NOT NULL REFERENCES users(user_id),
    assigned_by     UUID NOT NULL REFERENCES users(user_id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issue_id, contributor_id)
);

-- =====================================================================
-- CONSISTENCY TRIGGERS
-- =====================================================================

-- resource_type is redundant with which subtype table a row lives in.
-- Enforce it in the database, not just app code.
CREATE OR REPLACE FUNCTION check_resource_is_notebook() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM resources
        WHERE resource_id = NEW.notebook_id AND resource_type = 'NOTEBOOK'
    ) THEN
        RAISE EXCEPTION
            'resources.resource_type must be NOTEBOOK for resource_id %', NEW.notebook_id;
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
        RAISE EXCEPTION
            'resources.resource_type must be NOTE for resource_id %', NEW.note_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notes_resource_type
    BEFORE INSERT ON notes
    FOR EACH ROW EXECUTE FUNCTION check_resource_is_note();

-- Keep issues.status in sync when its winning branch gets merged. Caught by
-- testing: nothing previously stopped an issue sitting at status = 'OPEN'
-- while its selected branch already had is_merged = TRUE.
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
-- Postgres does not auto-index FK columns (only PKs / UNIQUE constraints
-- get one for free) — add them for every FK that will be joined or
-- filtered on regularly.
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

CREATE INDEX idx_branches_note               ON branches (note_id);
CREATE INDEX idx_branches_issue              ON branches (issue_id);
CREATE INDEX idx_branches_attempted_by       ON branches (attempted_by);
CREATE INDEX idx_branches_selected_by        ON branches (selected_by);

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

-- =====================================================================
-- Deletion semantics summary (see inline notes above for each table):
--   * notebooks.deleted_at / notes.deleted_at — the NORMAL user-facing
--     delete path. Nothing else needs to change; the app just filters
--     WHERE deleted_at IS NULL everywhere.
--   * Hard DELETE of a notebook/note cascades through resources, notes,
--     slots, issues, branches, editions — but will be BLOCKED the moment
--     it reaches commits / commit_manifests / editions.pinned_commit_id,
--     which intentionally have no ON DELETE. This is correct: this system's
--     commit history is meant to be immutable, so a casual cascading DELETE
--     should not be able to destroy it. A real purge (e.g. GDPR erasure)
--     needs an explicit administrative procedure that clears commits/
--     manifests/editions first — not a one-line DELETE.
--   * content_blobs are NEVER touched by cascade, anywhere — they're
--     shared/deduplicated across notes and forks and must be garbage
--     collected separately (delete only when zero versions reference them).
-- =====================================================================