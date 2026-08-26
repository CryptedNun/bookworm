# Book Worm — Full Project Documentation

**A version-controlled, collaborative note-taking platform.** Think "Git for
documents": every note has branches, commits, issues, and publishable
editions, built on a content-addressed storage layer that deduplicates text
automatically. This document covers the product concept, the complete
database design, and the proposed Next.js frontend/backend architecture.

> Note: the database's internal table names (`notebooks`, `notes`,
> `commits`, etc.) are generic and are **not** renamed to match the product
> name — only the product itself is called Book Worm. This keeps the schema
> readable as plain relational vocabulary rather than branded terminology.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Design Philosophy](#2-core-design-philosophy)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [Core Workflows](#5-core-workflows)
6. [Frontend Architecture (Next.js)](#6-frontend-architecture-nextjs)
7. [Backend / API Layer](#7-backend--api-layer)
8. [Security Considerations](#8-security-considerations)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Known Trade-offs & Future Considerations](#10-known-trade-offs--future-considerations)
11. [Glossary](#11-glossary)

---

## 1. Product Overview

Book Worm lets people write, version, and collaborate on structured
documents ("notes") the way developers collaborate on code. A note is made
of ordered blocks (headings, paragraphs, code, etc.), grouped into
notebooks. Every edit is versioned; every meaningful checkpoint is a commit;
collaboration happens through **issues** (a request to fix or improve one
specific block) and **branches** (a contributor's attempt at that issue) —
not live, simultaneous co-editing.

**Who it's for:** people writing living documents that benefit from
history, review, and safe experimentation — technical documentation,
study notes, collaborative wikis, evolving specs — where "who changed what,
when, and why" matters as much as the current text.

**What makes it different from Google Docs:** no operational transforms, no
live cursors, no merge conflicts to resolve by hand. Two people can never
edit the same block at the same time — the system prevents that by
construction — which trades real-time collaboration for guaranteed,
conflict-free async collaboration.

**What makes it different from GitHub:** the unit of change is a block
inside a document, not a line inside a text file, and the "diff" model is
replaced by a full-manifest model tuned for fast reads (see below).

---

## 2. Core Design Philosophy

These four ideas shape every table in the database and every workflow in
the product:

### 2.1 Three-layer content model

Content is split into three independent layers so that editing, versioning,
and forking are each cheap on their own:

| Layer | Table | Answers |
|---|---|---|
| 1. Structure | `logical_block_slots` | *Where* does a block sit in the document? |
| 2. Versions | `block_version_contents` | *Who* wrote *what*, for a given slot, *when*? |
| 3. Storage | `content_blobs` | What is the actual text, addressed by its own hash? |

### 2.2 Content-addressable storage (deduplication)

Every piece of text is stored once, system-wide, keyed by its SHA-256 hash
(`content_blobs.sha256`). If two different blocks — in different notes,
written by different users, at different times — happen to contain
identical text, they point at the same row. Forking a note costs almost
nothing in storage: new structural rows are created, but the actual text is
reused byte-for-byte until someone actually edits it.

### 2.3 Conflict-free collaboration via block locking

An **issue** targets exactly one block (`issues.target_slot_id`) and, while
open, blocks any other issue from targeting that same block (a partial
unique index, not application logic). Multiple contributors can each open
their own **branch** to attempt a fix, but because every attempt is scoped
to the same single block, there is never a scenario where two people's
changes to *different* blocks need to be reconciled — merging is always a
single-block swap, never a text merge.

### 2.4 Full-manifest commits (read-optimized, not diff-based)

Most version control systems store a commit as a diff and reconstruct state
by replaying history. Book Worm does the opposite: every commit stores a
**complete manifest** — one row per block in the document, including blocks
that didn't change (`commit_manifests`). Reading any commit is therefore a
single flat query (`WHERE commit_id = X`), not a walk through history. The
trade-off is write volume: editing one block in a 5,000-block note still
writes ~5,000 manifest rows for that commit. This is a deliberate bet that
reads (viewing/sharing published notes) will vastly outnumber writes
(edits) — see [§10](#10-known-trade-offs--future-considerations) for the
full discussion.

---

## 3. System Architecture

```
                    ┌─────────────────────────────────────┐
                    │              Vercel Edge              │
                    │  ┌─────────────────────────────────┐  │
                    │  │      Next.js 15 (App Router)     │  │
                    │  │  ┌───────────┐  ┌─────────────┐  │  │
                    │  │  │  Server   │  │   Server    │  │  │
                    │  │  │Components │  │  Actions /  │  │  │
                    │  │  │ (reads)   │  │Route Handlers│ │  │
                    │  │  │           │  │  (writes)   │  │  │
                    │  │  └─────┬─────┘  └──────┬──────┘  │  │
                    │  │        └───────┬────────┘        │  │
                    │  │                │                  │  │
                    │  │         ┌──────▼──────┐           │  │
                    │  │         │   Drizzle   │           │  │
                    │  │         │     ORM     │           │  │
                    │  │         └──────┬──────┘           │  │
                    │  └────────────────┼──────────────────┘  │
                    └───────────────────┼─────────────────────┘
                                         │ HTTPS (Neon serverless driver)
                                         ▼
                    ┌─────────────────────────────────────┐
                    │         Neon (serverless Postgres)     │
                    │   15 tables · triggers · constraints   │
                    └─────────────────────────────────────┘
```

There is no separate backend service: Next.js Server Components handle
reads directly against the database, and Server Actions / Route Handlers
handle writes. This is viable specifically *because* so much correctness
(cardinalities, business rules, self-approval prevention, etc.) is pushed
down into database constraints rather than left to be re-implemented and
potentially forgotten in application code — see [§4.6](#46-business-rules-enforced-at-the-database-level).

---

## 4. Database Design

### 4.1 Entity overview

15 tables across 5 functional areas:

| Area | Tables |
|---|---|
| 1. Users & Permissions | `users`, `resources`, `collaborator_roles`, `access_requests` |
| 2. Organizing Content | `notebooks`, `notes`, `editions`, `branches` |
| 3. The Content Itself | `logical_block_slots`, `block_version_contents`, `content_blobs` |
| 4. Working Together | `issues`, `issue_contributors` |
| 5. Tracking Changes | `commits`, `commit_manifests` |

A full Chen-notation ERD (entities, attributes, relationships, and
cardinalities) exists as a companion artifact (`erd_chens_notation.dot` /
`.pdf`) and should be treated as the canonical diagram alongside this
document.

### 4.2 The ISA hierarchy: `resources`, `notebooks`, `notes`

`resources` is a supertype table that both `notebooks` and `notes` inherit
from, so that permissions (`collaborator_roles`, `access_requests`) can
target "a thing" without caring whether that thing is a notebook or a note:

```sql
CREATE TABLE resources (
    resource_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   TEXT NOT NULL CHECK (resource_type IN ('NOTEBOOK', 'NOTE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notebooks (
    notebook_id UUID PRIMARY KEY REFERENCES resources(resource_id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL REFERENCES users(user_id),
    title       TEXT NOT NULL,
    description TEXT,
    deleted_at  TIMESTAMPTZ,
    visibility  TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC'))
);
```

`notebooks.notebook_id` **is** `resources.resource_id` — a shared primary
key, not an independent surrogate one. This is the correct way to model
ISA/specialization relationally: the subtype doesn't get its own identity,
it inherits the supertype's. Two `BEFORE INSERT` triggers
(`trg_notebooks_resource_type`, `trg_notes_resource_type`) additionally
guarantee that a row can only be inserted into `notebooks` if its matching
`resources` row is actually typed `'NOTEBOOK'` (and likewise for `notes` /
`'NOTE'`) — this closes a real redundancy risk: `resource_type` is
technically derivable from which subtype table a row lives in, and without
the trigger nothing would stop the two from drifting out of sync.

### 4.3 Full table reference

#### `users`

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID (PK) | |
| `email` | TEXT | `UNIQUE`, not null |
| `username` | TEXT | `UNIQUE`, not null |
| `avatar_url` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | default `now()` |
| `is_active` | BOOLEAN | default `TRUE` |

Deleting a user is intentionally *not* the normal path — every `*_by` /
`author_id` / `owner_id` foreign key elsewhere in the schema deliberately
has no `ON DELETE` clause (defaults to `RESTRICT`), so a user with any
history cannot be hard-deleted. `is_active` is the deactivation mechanism
instead. This keeps historical attribution (who authored this version, who
approved that request) permanently intact.

#### `resources`

ISA supertype — see [§4.2](#42-the-isa-hierarchy-resources-notebooks-notes).
Indexed on `resource_type` for fast "all notebooks" / "all notes" scans.

#### `notebooks`

See [§4.2](#42-the-isa-hierarchy-resources-notebooks-notes). `deleted_at`
is the normal user-facing delete mechanism (soft delete) — see
[§4.5](#45-deletion-semantics).

#### `notes`

| Column | Type | Notes |
|---|---|---|
| `note_id` | UUID (PK) | shared key with `resources.resource_id`, `ON DELETE CASCADE` |
| `notebook_id` | UUID | `NOT NULL`, references `notebooks`, `ON DELETE CASCADE` |
| `title` | TEXT | not null |
| `forked_from_note_id` | UUID | nullable, self-referencing, `ON DELETE SET NULL` |
| `default_edition_id` | UUID | nullable; FK added via `ALTER TABLE` after `editions` exists |
| `display_order` | INT | default `0` |
| `deleted_at` | TIMESTAMPTZ | soft delete |
| `visibility` | TEXT | `CHECK IN ('PRIVATE','SHARED','PUBLIC')` |

**The deferred foreign key.** `notes.default_edition_id` points at
`editions`, while `editions.note_id` points back at `notes` — a genuine
circular dependency, since neither table can be created with a working
constraint before the other exists. The fix: `default_edition_id` is
declared as a plain nullable `UUID` when `notes` is created, and the actual
foreign key constraint is added afterward, once `editions` exists:

```sql
ALTER TABLE notes
    ADD CONSTRAINT fk_notes_default_edition
    FOREIGN KEY (default_edition_id) REFERENCES editions(edition_id) ON DELETE SET NULL;
```

The application-level contract that goes with this: insert the note first
(`default_edition_id` stays `NULL`), then insert its first edition, *then*
`UPDATE notes SET default_edition_id = ...` — never attempt both inserts in
the same statement/transaction step.

**Forking.** `forked_from_note_id` is `ON DELETE SET NULL`, not `CASCADE`
or the default `RESTRICT` — if an original note is ever administratively
purged, its forks are independent content (their own slots, their own
version rows, only sharing already-immutable blob rows) and must survive;
they simply lose the "forked from" pointer.

#### `content_blobs`

| Column | Type | Notes |
|---|---|---|
| `sha256` | CHAR(64) (PK) | the content hash itself, not a generated UUID |
| `content_text` | TEXT | not null |
| `byte_size` | INT | not null |
| `created_at` | TIMESTAMPTZ | default `now()` |

Content-addressed storage — see [§2.2](#22-content-addressable-storage-deduplication).
No table anywhere cascades a `DELETE` into this one; blobs are shared
across notes and forks and can only be safely removed by a separate
garbage-collection process ("is this hash referenced by zero versions?"),
never by a cascading delete triggered from one note.

#### `logical_block_slots`

| Column | Type | Notes |
|---|---|---|
| `slot_id` | UUID (PK) | |
| `note_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `parent_slot_id` | UUID | nullable, self-referencing (nesting), `ON DELETE CASCADE` |
| `lexorank_key` | TEXT | fractional-index ordering key |
| `block_type` | TEXT | **no `CHECK` constraint** — see below |

Structure layer — *where* a block sits, independent of its content.
`lexorank_key` uses a fractional-indexing scheme so blocks can be
reordered or inserted between any two existing blocks in O(1), without
renumbering siblings.

`block_type` is the one enum-like column in the whole schema with no
`CHECK` constraint, and that's deliberate: it's meant to be an extensible,
plugin-style vocabulary (new block kinds shouldn't require a database
migration), unlike `resource_type` / `role_type` / `status` / `direction` /
`visibility`, which are a small, fixed, core-business vocabulary and do get
`CHECK` constraints.

Also carries `UNIQUE (note_id, slot_id)` — a composite unique that exists
purely so other tables (`issues`, below) can enforce cross-table
consistency via a real foreign key instead of a trigger.

#### `block_version_contents`

| Column | Type | Notes |
|---|---|---|
| `version_id` | UUID (PK) | |
| `slot_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `author_id` | UUID | `NOT NULL`, references `users` |
| `content_blob_hash` | CHAR(64) | `NOT NULL`, references `content_blobs.sha256` |
| `created_at` | TIMESTAMPTZ | default `now()` |

Version layer — *who* wrote *what*, for a given slot, *when*. Also carries
`UNIQUE (slot_id, version_id)`, mirroring the pattern on
`logical_block_slots`, for the same reason: it lets `commit_manifests`
enforce a real cross-table invariant via a composite foreign key rather
than a trigger (see below).

#### `issues`

| Column | Type | Notes |
|---|---|---|
| `issue_id` | UUID (PK) | |
| `note_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `target_slot_id` | UUID | `NOT NULL` — constrained by the composite FK below |
| `creator_id` | UUID | `NOT NULL`, references `users` |
| `title` | TEXT | not null |
| `status` | TEXT | `CHECK IN ('OPEN','IN_PROGRESS','MERGED','CLOSED')`, default `'OPEN'` |

```sql
FOREIGN KEY (note_id, target_slot_id) REFERENCES logical_block_slots (note_id, slot_id) ON DELETE CASCADE,
UNIQUE (note_id, issue_id)
```

The composite foreign key on `(note_id, target_slot_id)` is not
decorative: without it, nothing stops an issue from being created on one
note while targeting a block that actually belongs to a *different* note —
a real, silently-accepted data-corruption bug found during testing and
fixed structurally rather than papered over with a trigger.

A partial unique index enforces the actual business rule — a block may
have many issues filed against it over its lifetime, but never more than
one **active** one at a time:

```sql
CREATE UNIQUE INDEX uq_one_active_issue_per_slot
    ON issues (target_slot_id)
    WHERE status IN ('OPEN', 'IN_PROGRESS');
```

#### `branches`

| Column | Type | Notes |
|---|---|---|
| `branch_id` | UUID (PK) | |
| `note_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `issue_id` | UUID | `NULL` only for the main branch |
| `attempted_by` | UUID | `NULL` only for the main branch; the one person working this attempt |
| `branch_name` | TEXT | not null |
| `is_main` | BOOLEAN | default `FALSE` |
| `is_merged` | BOOLEAN | default `FALSE` |
| `selected_by` | UUID | nullable; the maintainer who picked this as the winning attempt |
| `selected_at` | TIMESTAMPTZ | nullable |

An issue is a *permission to attempt a fix*, not a single branch: several
contributors or maintainers can each open their own branch against the
same issue (a 1:N relationship), and a maintainer later picks exactly one
winner. Every branch has exactly one worker. The main branch never
attaches to any issue at all.

```sql
FOREIGN KEY (note_id, issue_id) REFERENCES issues (note_id, issue_id) ON DELETE CASCADE,

CONSTRAINT chk_main_xor_attempt CHECK (
    (is_main = TRUE  AND issue_id IS NULL     AND attempted_by IS NULL
                      AND is_merged = FALSE    AND selected_by IS NULL)
    OR
    (is_main = FALSE AND issue_id IS NOT NULL AND attempted_by IS NOT NULL)
),
CONSTRAINT chk_selection_pair CHECK ((selected_by IS NULL) = (selected_at IS NULL)),
CONSTRAINT chk_merge_requires_selection CHECK (is_merged = (selected_by IS NOT NULL))
```

Three things this rules out, all confirmed as real bugs during testing
before the constraints existed: the main branch being marked merged (it's
the merge *target*, not something merged into itself); `is_merged = TRUE`
with no `selected_by` recorded (an inconsistent state); and an attempt
branch missing its required issue or worker.

Two partial unique indexes back these rules at the table level:

```sql
CREATE UNIQUE INDEX uq_one_main_branch_per_note ON branches (note_id) WHERE is_main = TRUE;
CREATE UNIQUE INDEX uq_one_selected_branch_per_issue ON branches (issue_id) WHERE is_merged = TRUE;
```

#### `commits`

| Column | Type | Notes |
|---|---|---|
| `commit_id` | UUID (PK) | |
| `branch_id` | UUID | `NOT NULL`, references `branches` |
| `parent_commit_id` | UUID | nullable, self-referencing |
| `author_id` | UUID | `NOT NULL`, references `users` |
| `commit_message` | TEXT | nullable |
| `commit_hash` | TEXT | `UNIQUE`, not null |
| `created_at` | TIMESTAMPTZ | default `now()` |

Single-parent commit chain, deliberately — see
[§10](#10-known-trade-offs--future-considerations) for why this isn't a
true two-parent git merge. No table cascades a `DELETE` into `commits`,
and `commits` itself has no `ON DELETE` on its own foreign keys — commits
are meant to be permanent, append-only history. This is also precisely
what makes hard-deleting a note with any real activity fail by design (see
[§4.5](#45-deletion-semantics)).

#### `commit_manifests`

| Column | Type | Notes |
|---|---|---|
| `manifest_id` | UUID (PK) | surrogate key |
| `commit_id` | UUID | `NOT NULL`, references `commits` |
| `slot_id` | UUID | `NOT NULL` — constrained by the composite FK below |
| `version_id` | UUID | `NOT NULL` — constrained by the composite FK below |

```sql
UNIQUE (commit_id, slot_id),   -- exactly one version per (commit, slot)
FOREIGN KEY (slot_id, version_id) REFERENCES block_version_contents (slot_id, version_id)
```

This is a genuine **ternary relationship** (commit × slot × version), and
it carries its own surrogate key (`manifest_id`), which is why it's a real
table rather than a pure join. The composite foreign key on
`(slot_id, version_id)` — rather than two independent plain foreign keys —
is what guarantees a manifest row's `version_id` actually belongs to the
`slot_id` it claims. This was found to be a real, silent corruption path
during testing: with two separate foreign keys, nothing stopped a manifest
from pairing a slot with a version that actually belonged to a completely
different slot.

Every commit writes one manifest row **per block in the note, including
unchanged ones** — see [§2.4](#24-full-manifest-commits-read-optimized-not-diff-based).

#### `editions`

| Column | Type | Notes |
|---|---|---|
| `edition_id` | UUID (PK) | |
| `note_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `edition_name` | TEXT | not null |
| `share_code` | TEXT | `UNIQUE`, not null |
| `pinned_commit_id` | UUID | `NOT NULL`, references `commits` — **no `ON DELETE`** |
| `is_standard` | BOOLEAN | default `FALSE` |
| `created_by` | UUID | `NOT NULL`, references `users` |

A named, immutable, publicly shareable pointer at one specific commit —
decoupled from the raw commit timeline so a reader following a link sees a
stable snapshot even while editing continues on main.
`pinned_commit_id` intentionally has no `ON DELETE`, which is one of the
walls (along with `commit_manifests`) that makes hard-deleting a
history-bearing note fail by design.

#### `collaborator_roles`

| Column | Type | Notes |
|---|---|---|
| `role_id` | UUID (PK) | |
| `user_id` | UUID | `NOT NULL`, references `users` |
| `resource_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `role_type` | TEXT | `CHECK IN ('OWNER','MAINTAINER','CONTRIBUTOR')` |
| `capabilities` | JSONB | default `'{}'` — fine-grained flags beyond the coarse role |
| `granted_by` | UUID | `NOT NULL`, references `users` |

`UNIQUE (user_id, resource_id)` — one role per user per resource. Targets
`resources` (not `notebooks`/`notes` directly) so permissions work
uniformly across the ISA hierarchy without branching on type.

#### `access_requests`

| Column | Type | Notes |
|---|---|---|
| `request_id` | UUID (PK) | |
| `user_id` | UUID | the subject of the request |
| `initiated_by` | UUID | who initiated it |
| `resource_id` | UUID | `NOT NULL`, `ON DELETE CASCADE` |
| `requested_role` | TEXT | `CHECK IN ('OWNER','MAINTAINER','CONTRIBUTOR')` |
| `direction` | TEXT | `CHECK IN ('REQUEST','INVITE')` |
| `status` | TEXT | `CHECK IN ('PENDING','APPROVED','REJECTED','CANCELLED')` |
| `reviewed_by` | UUID | nullable |

Three `CHECK` constraints encode real business meaning here, each one
closing a hole found during testing:

```sql
-- REQUEST = "let me in" (self-initiated); INVITE = "come join us" (someone else initiates)
CONSTRAINT chk_request_direction_consistency CHECK (
    (direction = 'REQUEST' AND initiated_by = user_id)
    OR
    (direction = 'INVITE'  AND initiated_by <> user_id)
),
-- a reviewer is recorded exactly when the request has actually been decided
CONSTRAINT chk_review_matches_status CHECK (
    (status IN ('APPROVED', 'REJECTED')) = (reviewed_by IS NOT NULL)
),
-- can't approve your own REQUEST; accepting your own INVITE is fine (you ARE the reviewer)
CONSTRAINT chk_reviewer_not_self_request CHECK (
    direction = 'INVITE' OR reviewed_by IS DISTINCT FROM user_id
)
```

#### `issue_contributors`

| Column | Type | Notes |
|---|---|---|
| `issue_id` | UUID | `NOT NULL`, `ON DELETE CASCADE`, part of composite PK |
| `contributor_id` | UUID | `NOT NULL`, references `users`, part of composite PK |
| `assigned_by` | UUID | `NOT NULL`, references `users` |
| `assigned_at` | TIMESTAMPTZ | default `now()` |

`PRIMARY KEY (issue_id, contributor_id)`. An associative entity — its key
is entirely structural (the combination of the two relationships it
connects), which is why there is no separate surrogate `id` column here,
unlike `commit_manifests` (which needed one because it's independently
referenced/tracked as its own thing).

### 4.4 Triggers

| Trigger | Fires on | Purpose |
|---|---|---|
| `trg_notebooks_resource_type` | `BEFORE INSERT` on `notebooks` | Rejects the insert unless the matching `resources` row is typed `'NOTEBOOK'` |
| `trg_notes_resource_type` | `BEFORE INSERT` on `notes` | Rejects the insert unless the matching `resources` row is typed `'NOTE'` |
| `trg_branch_merge_updates_issue` | `AFTER UPDATE OF is_merged` on `branches` | When a branch flips to `is_merged = TRUE`, automatically sets its issue's `status` to `'MERGED'` — closes a gap where an issue could sit at `'OPEN'` while its winning branch already said otherwise |

### 4.5 Deletion semantics

This was deliberately worked out rather than left implicit:

- **Normal delete = soft delete.** `notebooks.deleted_at` / `notes.deleted_at`
  are the user-facing "delete" action. The application filters
  `WHERE deleted_at IS NULL` everywhere; nothing else has to change.
- **Hard `DELETE` cascades partially, then fails on purpose.** A hard
  delete of a notebook/note cascades through `resources` → `notes` →
  `logical_block_slots` / `issues` / `branches` / `editions`, but hits a
  wall the moment it reaches `commits`, `commit_manifests`, or
  `editions.pinned_commit_id` — none of which have `ON DELETE` set. This
  is correct, not an oversight: commit history is meant to be immutable,
  so it should not be possible to destroy years of version history with a
  single cascading `DELETE` statement. A genuine purge (e.g. GDPR erasure)
  requires an explicit administrative procedure that clears commits,
  manifests, and editions first.
- **`content_blobs` are never touched by cascade, anywhere.** They're
  deduplicated across notes and forks; the only safe way to remove one is
  a garbage-collection sweep that confirms zero versions still reference
  it.

### 4.6 Business rules enforced at the database level

A summary of every non-obvious constraint, in one place:

| Rule | Mechanism |
|---|---|
| A slot can have many issues over time, but only one active at once | Partial unique index on `issues(target_slot_id)` |
| Exactly one main branch per note | Partial unique index on `branches(note_id)` |
| At most one selected/merged branch per issue | Partial unique index on `branches(issue_id)` |
| Main branch can never be "merged" or "selected" | `CHECK` constraint on `branches` |
| `is_merged` and `selected_by` can never disagree | `CHECK` constraint on `branches` |
| A manifest's slot and version must genuinely belong together | Composite FK on `commit_manifests` |
| An issue's target slot must belong to the issue's own note | Composite FK on `issues` |
| A branch's issue must belong to the branch's own note | Composite FK on `branches` |
| `resource_type` can't drift from the actual subtype table | `BEFORE INSERT` triggers |
| Issue status can't lag behind its winning branch | `AFTER UPDATE` trigger |
| Can't approve your own access request (but can accept your own invite) | `CHECK` constraint on `access_requests` |
| A `REQUEST`'s subject must be its own initiator; an `INVITE`'s must not be | `CHECK` constraint on `access_requests` |
| A reviewer is set if and only if the request was actually decided | `CHECK` constraint on `access_requests` |

---

## 5. Core Workflows

**Creating a note.** Insert a `resources` row (`'NOTE'`), then the matching
`notes` row, then an initial main `branches` row (`is_main = TRUE`), an
initial `logical_block_slots` row per starting block, a `content_blobs` +
`block_version_contents` row per block, and a first `commits` row on the
main branch with a full `commit_manifests` snapshot.

**Filing an issue and attempting it.** A maintainer opens an `issues` row
targeting one `logical_block_slots` row (blocked if another issue is
already active on that slot). Each contributor who wants to attempt it gets
their own `branches` row (`is_main = FALSE`, `attempted_by` = them), edits
create new `content_blobs`/`block_version_contents` rows for that one slot,
and each attempt commits its own full manifest.

**Selecting a winner and merging.** A maintainer sets the winning branch's
`is_merged = TRUE` and `selected_by`/`selected_at` — this fires
`trg_branch_merge_updates_issue`, flipping the issue to `'MERGED'`
automatically. A new commit is then written **on the main branch**, whose
manifest is main's previous manifest with the one changed slot swapped to
the winning version. Losing attempts are simply left unmerged — no data is
destroyed.

**Publishing an edition.** Insert an `editions` row pinned at a specific
commit, then `UPDATE notes SET default_edition_id = ...` to close the
deferred-FK loop described in [§4.3](#43-full-table-reference).

**Forking.** Create a new `resources`/`notes` row with
`forked_from_note_id` set to the original, new `logical_block_slots` rows,
and new `block_version_contents` rows — but reuse the *same*
`content_blobs` rows wherever the text is unchanged, since identical text
hashes identically.

**Requesting or granting access.** Either the user requests it themselves
(`direction = 'REQUEST'`, `initiated_by = user_id`) or someone invites them
(`direction = 'INVITE'`, `initiated_by <> user_id`). A `collaborator_roles`
row is created once approved/accepted.

---

## 6. Frontend Architecture (Next.js)

### 6.1 Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router | Server Components for cheap reads, Server Actions for writes, single deployable unit |
| Language | TypeScript | End-to-end type safety, especially valuable given how much meaning lives in the DB constraints |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, accessible primitives without a heavy design-system dependency |
| Editor | Custom block editor (dnd-kit for reordering + a per-block rich-text layer, e.g. Tiptap) | The block model (`logical_block_slots` + `lexorank_key`) doesn't map onto a single flat rich-text document — each block is its own editable, versionable, lockable unit |
| Server state | TanStack Query | Caches reads, handles revalidation after Server Actions, manages optimistic UI for things like drag-reordering |
| Client state | Zustand (minimal) | Local editor UI state only (which block is focused, drag state) — not source of truth |
| Auth | Auth.js (NextAuth) | Email + OAuth providers, session stored server-side, maps directly onto `users` |
| Forms | React Hook Form + Zod | Shared Zod schemas between client validation and Server Action input validation |

### 6.2 App Router structure

```
app/
├── (marketing)/                     # public landing page, no auth required
│   └── page.tsx
├── (app)/                           # authenticated app shell
│   ├── layout.tsx                   # sidebar: notebooks, notifications, user menu
│   ├── notebooks/
│   │   ├── page.tsx                 # list of notebooks the user can see
│   │   └── [notebookId]/
│   │       └── page.tsx             # list of notes in a notebook
│   ├── notes/
│   │   └── [noteId]/
│   │       ├── page.tsx             # default edition (read) or main branch (if collaborator)
│   │       ├── edit/
│   │       │   └── page.tsx         # main branch editor (maintainers only)
│   │       ├── branches/
│   │       │   └── [branchId]/
│   │       │       └── page.tsx     # editing a specific attempt branch
│   │       ├── issues/
│   │       │   ├── page.tsx         # list of issues on this note
│   │       │   └── [issueId]/
│   │       │       └── page.tsx     # issue detail: attempts side-by-side, select-winner action
│   │       ├── history/
│   │       │   └── page.tsx         # commit log for the main branch
│   │       └── editions/
│   │           ├── page.tsx         # manage published editions
│   │           └── new/
│   │               └── page.tsx     # publish a new edition
│   └── settings/
│       ├── page.tsx                 # profile
│       └── access-requests/
│           └── page.tsx             # review pending requests/invites
├── e/
│   └── [shareCode]/
│       └── page.tsx                 # PUBLIC read-only edition view, no auth required
└── api/
    └── webhooks/…                   # third-party webhooks only; app mutations use Server Actions
```

### 6.3 Key pages, in plain terms

- **`/notebooks`** — everything the signed-in user owns or collaborates on.
- **`/notes/[noteId]`** — the "read" view: renders the note's
  `default_edition_id` snapshot for non-collaborators, or the live main
  branch for anyone with a role on the resource.
- **`/notes/[noteId]/issues/[issueId]`** — the heart of the collaboration
  model: shows every attempt branch on that issue side-by-side (not a
  merge-conflict UI — there's never a conflict, just competing full
  drafts of one block), with a "select this one" action visible only to
  maintainers.
- **`/e/[shareCode]`** — the public share page. Looked up directly by
  `editions.share_code`, rendered from `commit_manifests` at
  `pinned_commit_id` — no auth check needed at all, since an edition is
  the intentionally-public artifact.
- **`/notes/[noteId]/history`** — a commit log per branch, useful mainly
  on `main` since attempt branches are short-lived by design.

### 6.4 Component architecture (high level)

- **`<BlockEditor>`** — orchestrates the ordered list of blocks for a given
  branch; owns drag-and-drop reordering (writes new `lexorank_key`s) and
  dispatches per-block edits.
- **`<SlotBlock>`** — one block. Renders read-only or editable depending on
  whether the current branch is locked/owned by the viewer; on edit, debounces
  and calls a Server Action that creates a new `content_blobs` +
  `block_version_contents` row.
- **`<BranchSwitcher>`** — lets a collaborator jump between main and any
  branch they can see.
- **`<AttemptComparison>`** — the issue-detail view's core: pulls each
  attempt branch's latest commit manifest for the *one* targeted slot and
  renders them side-by-side. (Not a text diff — full alternative drafts.)
- **`<CommitHistory>`** — a simple list driven by walking
  `parent_commit_id`.
- **`<PermissionsPanel>`** — role management + pending access requests for
  a resource, gated by the viewer's own `role_type`.

### 6.5 Data-fetching strategy

- **Reads default to Server Components.** A page like
  `/notes/[noteId]/history` fetches directly via Drizzle in the Server
  Component — no client-side loading spinner needed for the initial paint.
- **Writes are Server Actions**, colocated with the components that call
  them (e.g. `selectWinningBranch` lives next to `<AttemptComparison>`).
  Each Server Action re-validates permissions server-side — the UI hiding
  a button is a convenience, not the security boundary (see [§8](#8-security-considerations)).
- **TanStack Query wraps client-side interactive bits** (live block editing,
  optimistic drag-reorder) and calls `router.refresh()` / query
  invalidation after a Server Action succeeds, so Server Components and
  client state stay consistent without a bespoke sync layer.

### 6.6 On real-time collaboration

There is deliberately no live-cursor, no WebSocket-driven co-editing layer.
The product's conflict-free guarantee comes from block-locking at the
database level (`uq_one_active_issue_per_slot`), not from an operational
transform engine — adding real-time presence (e.g. "Bob is viewing this
branch") is a reasonable future addition via a lightweight presence channel
(Vercel's realtime primitives or Pusher), but it should stay presence-only;
introducing live co-editing would undermine the entire block-locking model
this schema is built around.

---

## 7. Backend / API Layer

### 7.1 Approach

No standalone backend service. Next.js **Route Handlers** cover the few
things that genuinely need a URL (the public share-page data fetch,
webhooks), and **Server Actions** cover everything that's a mutation
triggered from a form or button inside the app. This keeps the entire
system inside one Vercel deployment, talking to Neon over its HTTP-based
serverless driver (works well from Vercel's edge/serverless runtime without
needing a persistent connection pool).

### 7.2 ORM: Drizzle

Drizzle is the recommended ORM, over Prisma, specifically because:

- Its query builder compiles to SQL close enough to hand-written SQL that
  the composite foreign keys, partial unique indexes, and `CHECK`
  constraints in this schema all map directly — nothing about this
  schema's less-common Postgres features needs to be "worked around."
  Prisma is not a bad choice, but historically underhandles more advanced Postgres constraint types.
- `drizzle-orm/neon-http` is purpose-built for Neon's serverless driver,
  matching the Vercel deployment target.
- Schema is defined in TypeScript, colocated with the app, and
  `drizzle-kit` generates migrations diffed directly against `schema.sql` —
  the source of truth stays the SQL file this project already has,
  described in [§4](#4-database-design).

### 7.3 Representative Server Actions

| Action | Tables touched | Notes |
|---|---|---|
| `createNotebook` | `resources`, `notebooks`, `collaborator_roles` | Creator gets `OWNER` immediately |
| `createNote` | `resources`, `notes`, `branches` (main), `logical_block_slots`, `content_blobs`, `block_version_contents`, `commits`, `commit_manifests` | The full "note creation" cascade from [§5](#5-core-workflows) |
| `forkNote` | `resources`, `notes`, `logical_block_slots`, `block_version_contents`, `branches`, `commits`, `commit_manifests` | Reuses existing `content_blobs` rows wherever content is unchanged |
| `openIssue` | `issues` | Rejected server-side (mirroring the DB) if the slot already has an active issue |
| `openAttemptBranch` | `branches` | One per contributor per issue |
| `commitToBranch` | `content_blobs`, `block_version_contents`, `commits`, `commit_manifests` | Always writes a *full* manifest, not a diff |
| `selectWinningBranch` | `branches` (update), `commits`, `commit_manifests` | Fires `trg_branch_merge_updates_issue` in the DB |
| `publishEdition` | `editions`, `notes` (update) | Two-step, per the deferred-FK contract |
| `requestAccess` / `inviteUser` | `access_requests` | Validated against `chk_request_direction_consistency` regardless — server-side check is a UX nicety |
| `reviewAccessRequest` | `access_requests` (update), `collaborator_roles` (insert) | Server-side self-approval check backed by `chk_reviewer_not_self_request` |

### 7.4 Auth & session

Auth.js sessions map directly onto `users.user_id`. On first sign-in via an
OAuth provider (or email), a `users` row is created with `is_active =
TRUE`; the session's `user.id` is used as the `user_id` value passed into
every Server Action for permission checks and `*_by`/`author_id`
attribution.

### 7.5 Authorization pattern

Every Server Action that touches a resource starts by checking
`collaborator_roles` for `(session.user.id, resource_id)`:

```ts
const role = await db.query.collaboratorRoles.findFirst({
  where: and(eq(t.userId, session.user.id), eq(t.resourceId, resourceId)),
});
if (!role || !allows(role, action)) throw new ForbiddenError();
```

`role.capabilities` (JSONB) allows fine-grained overrides on top of the
coarse `role_type` (e.g. a `CONTRIBUTOR` explicitly granted
`can_merge_branch: true`) without needing a schema migration for every new
permission flag — the trade-off, as noted in [§4](#4-database-design), is
that these fine-grained flags aren't independently indexable/queryable the
way a normalized permissions table would be. Acceptable for this scale;
worth revisiting if permission queries become a bottleneck.

### 7.6 Content hashing

Hashing happens server-side, in the Server Action, before the
`content_blobs` insert — never trust a client-supplied hash:

```ts
import { createHash } from "node:crypto";
const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
```

This must produce byte-identical output to Postgres's own
`encode(digest(text, 'sha256'), 'hex')` (used in `seed.sql`) for the
deduplication guarantee to hold — both operate on the UTF-8 bytes of the
same string, so this is safe as long as the app never re-encodes or
normalizes text differently than the seed data does.

### 7.7 Avatars / file storage

`users.avatar_url` is a plain URL column; actual file storage is out of
this schema's scope. Vercel Blob is the natural default for a Vercel
deployment (signed upload URLs from a Server Action, public read URL
stored back onto `avatar_url`).

---

## 8. Security Considerations

- **Server Actions are the real authorization boundary, not the UI.** A
  hidden button is a UX nicety; every mutating Server Action re-checks
  `collaborator_roles` itself, and the database's own `CHECK` constraints
  (self-approval, direction consistency, etc.) are a second, independent
  backstop that holds even if a Server Action's own check has a bug.
- **Public share pages (`/e/[shareCode]`) are intentionally unauthenticated**
  — that's the point of an edition — but the Route Handler backing them
  should rate-limit by IP to prevent `share_code` enumeration.
- **Block content needs output sanitization**, not just at write time.
  `content_text` is stored as plain text/markdown-ish source; whatever
  renders it (the block editor's read mode, the public edition page) must
  sanitize before rendering as HTML, since block content is
  user-generated and will be viewed by other users.
- **Rate-limit issue/branch creation** per user per note to prevent one
  contributor from spamming attempt branches (nothing in the DB caps how
  many attempts an issue can have — that's deliberate, but the app layer
  should still guard against abuse).
- **Session/user deactivation (`is_active = FALSE`) should also revoke
  active sessions**, not just block new sign-ins — otherwise a
  deactivated-but-still-logged-in user retains write access until their
  session naturally expires.

---

## 9. Deployment & Infrastructure

- **Hosting:** Vercel, for both the Next.js app and its Server
  Actions/Route Handlers — a single deployable unit, no separate backend
  infra to run.
- **Database:** Neon (serverless Postgres). Notably, Neon's own
  **database branching** feature is a nice operational parallel to this
  product's own branch/commit model: every PR can get its own ephemeral,
  copy-on-write database branch seeded from `schema.sql` + `seed.sql`,
  torn down automatically when the PR closes.
- **Environment variables:** `DATABASE_URL` (Neon pooled connection
  string), Auth.js provider secrets, `BLOB_READ_WRITE_TOKEN` (Vercel Blob),
  `NEXTAUTH_SECRET`.
- **Migrations:** `drizzle-kit generate` / `drizzle-kit push` against
  Neon, run in CI before deploy; `schema.sql` remains the canonical,
  hand-auditable reference even once Drizzle's TypeScript schema is the
  day-to-day source for the app.
- **CI:** on every PR — type-check, lint, run `schema.sql` + `seed.sql`
  against a fresh Neon branch, run integration tests against that branch,
  tear it down.

---

## 10. Known Trade-offs & Future Considerations

Carried over from the database design review, because they're product
decisions as much as schema decisions:

- **Full-manifest commits trade write cost for read speed.** A commit on a
  5,000-block note writes ~5,000 manifest rows even for a one-block edit.
  Correct bet if reads (viewing/sharing) vastly outnumber writes (editing),
  which is the expected usage pattern — worth re-measuring if that
  assumption turns out to be wrong at scale.
- **No live, simultaneous co-editing.** A deliberate trade for guaranteed
  conflict-freedom via block-locking, not a stopgap — see [§6.6](#66-on-real-time-collaboration).
  Don't build toward OT/CRDT-style live editing without revisiting the
  whole permission/branching model first.
- **Single-parent commits only.** Merging is a squash-style copy (one new
  commit on main, one parent), not a true two-parent git merge. Adding
  real multi-parent history would need a `commit_parents` join table
  instead of the current `parent_commit_id` column — a bigger change than
  a tweak, flagged as a possible future extension, not currently needed
  given how merging actually works in this product (pick one winning
  attempt, not combine two).
- **`capabilities` (JSONB) is flexible but not independently queryable.**
  Fine for "does this user have capability X" checks; harder to
  efficiently answer "who across the whole workspace can delete branches"
  without a JSON-aware index. Revisit if that kind of cross-cutting
  permission query becomes common.
- **Hard delete is intentionally hard.** See [§4.5](#45-deletion-semantics).
  This is correct for a product built around immutable history, but it
  does mean a genuine data-erasure request (GDPR, etc.) needs a real
  administrative runbook, not a button.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Notebook** | A folder of notes. |
| **Note** | A single versioned document, made of blocks. |
| **Block / Slot** | One unit of content within a note (`logical_block_slots`) — its *position*, independent of its current text. |
| **Version** | A specific piece of content ever written for a given slot (`block_version_contents`). |
| **Blob** | The actual text itself, stored once and referenced by hash (`content_blobs`). |
| **Issue** | A request to fix/improve one specific block; also the lock that prevents two people editing that block at once. |
| **Branch** | One contributor's attempt at an issue (or the note's permanent `main`). |
| **Commit** | A full snapshot (manifest) of every block's current version, on a branch, at a point in time. |
| **Manifest** | The set of (slot → version) pairs that make up one commit. |
| **Edition** | A named, immutable, publicly shareable pointer at one specific commit. |
| **Fork** | An independent copy of a note, in another notebook, that reuses the original's content blobs until edited. |
| **Resource** | The ISA supertype of notebooks and notes — the thing permissions are actually granted against. |