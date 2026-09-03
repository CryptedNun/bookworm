# BookWorm: Complete Specification & Elite Feature Checklist

**Project:** BookWorm — Git-like Version Control for Structured Notes  
**Standard Specification Reference:** [`bookworm.md`](./bookworm.md)  
**Database Model:** 15+ Tables, 3-Layer CAS Content Model, ISA Polymorphic Hierarchy, Ternary Manifests  
**Stack:** Next.js 15, TypeScript Strict, Neon Serverless PostgreSQL (Raw SQL), Tailwind CSS  

---

## 📋 Table of Contents
1. [Core Features from bookworm.md (By Functional Area)](#1-core-features-from-bookwormmd)
2. [Elite Level Note Sharing Platform Additions](#2-elite-level-additions)
3. [Gap Analysis & Implementation Status Tracker](#3-gap-analysis--implementation-status-tracker)

---

## 1. Core Features from `bookworm.md`

### Area 1: Users & Permissions
- [x] **User Management (`users`)**:
  - [x] User registration and sign-in with unique email and username.
  - [x] Cryptographic password security: per-user salt + SHA-256 password hash.
  - [x] System-level authorization roles (`ADMIN`, `USER`).
  - [x] Profile statistics tracking (notebooks owned, notes owned, contributions, total commits).
  - [x] Session management via secure HTTP-only cookies and JWT.
- [x] **Polymorphic ISA Hierarchy Supertype (`resources`)**:
  - [x] Unified supertype `resources` table for notebooks and notes.
  - [x] Database consistency triggers (`check_resource_is_notebook`, `check_resource_is_note`) enforcing discriminator integrity.
  - [x] Foreign key unification allowing permissions to target any resource seamlessly.
- [x] **Role-Based Access Control (`collaborator_roles`)**:
  - [x] Granular role levels: `OWNER`, `MAINTAINER`, `CONTRIBUTOR`.
  - [x] Capability overrides via JSONB (`can_create_issue`, `can_merge_branch`, `can_delete_branch`, `can_add_contributor`).
  - [x] Role management interface with permission auditing.
- [x] **Access Request System (`access_requests`)**:
  - [x] Bidirectional request model (`REQUEST` by prospective collaborator, `INVITE` by maintainer).
  - [x] Audit lifecycle states: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
  - [x] Review workflow updating `collaborator_roles` automatically.
- [x] **Notification Hub (`notifications`)**:
  - [x] Real-time notification system with unread counters and badge indicators.
  - [x] Notification types for access requests, approvals, denials, collaborator additions/removals, role changes, issue assignments, and branch merges.
  - [x] Notification dismissal and mark-as-read actions.

---

### Area 2: Organizing Content
- [x] **Notebook Collections (`notebooks`)**:
  - [x] Resource subtype sharing primary key with `resources(resource_id)`.
  - [x] Attributes: `title`, `description`, `owner_id`, `visibility` (`PUBLIC`, `PRIVATE`, `UNLISTED`).
  - [x] Soft delete support via `deleted_at`.
  - [x] Drag-to-reorder notes within a notebook.
  - [x] Notebook management page with Collaborators & Permissions tabs.
- [x] **Document Notes (`notes`)**:
  - [x] Resource subtype belonging to a parent notebook.
  - [x] Display ordering within notebook (`display_order`).
  - [x] Note visibility rules (`PUBLIC`, `PRIVATE`, `UNLISTED`).
  - [x] Soft deletion support.
- [x] **Named Snapshot Publishing (`editions`)**:
  - [x] Creation of immutable, named snapshots (`edition_name` e.g. "v1.0", "Release 2026").
  - [x] Pinning to specific commits (`pinned_commit_id`).
  - [x] Custom shareable URLs with human-friendly slug codes (`share_code` e.g. `cs101-intro-v2`).
  - [x] Default canonical edition setting per note (`default_edition_id`, `is_standard`).
  - [x] Dedicated public reader view at `/e/[shareCode]`.
- [x] **Dual Branch Architecture (`branches`)**:
  - [x] Every note initialized with exactly ONE main branch (`is_main = TRUE`, `issue_id = NULL`).
  - [x] Temporary isolated issue attempt branches (`is_main = FALSE`, `issue_id = <uuid>`, `attempted_by = <uuid>`).
  - [x] Database check constraints ensuring XOR invariants between main and issue branches.
  - [x] Merge selection tracking (`is_merged`, `selected_by`, `selected_at`).

---

### Area 3: The Content Itself (3-Layer Architecture)
- [x] **Layer 1: Structure (`logical_block_slots`)**:
  - [x] Decouples block position in a document from its text content.
  - [x] LexoRank fractional indexing (`lexorank_key` e.g. `1|150000`) enabling O(1) midpoint block insertions without renumbering.
  - [x] Drag-and-drop block reordering updating LexoRank keys.
  - [x] In-place text selection splitting creating new block slots.
  - [x] Block types: `PARAGRAPH`, `HEADING`, `CODE`, `QUOTE`.
  - [x] **Hierarchical Block Nesting (`parent_slot_id`)**: Parent-child relationship for sub-blocks, outlines, and collapsible sections.
  - [x] **LexoRank Rebalancing (FAQ Q7)**: Automated engine to re-space crowded fractional keys back to clean standard increments.
- [x] **Layer 2: Versions (`block_version_contents`)**:
  - [x] Immutable version record for every edit (`version_id`, `slot_id`, `author_id`, `created_at`).
  - [x] References content blob hash rather than duplicating text.
  - [x] Full audit trail of who edited each block and when.
- [x] **Layer 3: Storage Engine (`content_blobs`)**:
  - [x] Content-Addressed Storage (CAS) with SHA-256 primary key (`sha256`, `content_text`, `byte_size`).
  - [x] Global deduplication across all notes, notebooks, and users (`ON CONFLICT DO NOTHING`).
  - [x] Storage savings calculation comparing raw block bytes against unique CAS blob bytes.
- [x] **Zero-Cost Note Forking**:
  - [x] Fork any public note into your own notebook.
  - [x] Replicates slot structures and version pointers with zero new text bytes copied.
  - [x] Preserves lineage through `forked_from_note_id`.

---

### Area 4: Working Together (Zero-Conflict Collaboration)
- [x] **Block-Level Issues (`issues`)**:
  - [x] Issues target specific document slots (`target_slot_id`).
  - [x] **Deterministic Block Locking**: Database partial unique index (`uq_one_active_issue_per_slot`) ensuring at most ONE active issue per block at any time.
  - [x] Lifecycle statuses: `OPEN`, `IN_PROGRESS`, `MERGED`, `CLOSED`.
- [x] **Multi-Contributor Attempts (`issue_contributors`)**:
  - [x] Multiple contributors assigned to an issue (`issue_contributors` junction).
  - [x] Contributors fork parallel attempt branches for the same issue.
- [x] **Maintainer Merge Selection & Branch Diff**:
  - [x] Side-by-side visual diff comparison between attempt branch and main branch before merging.
  - [x] Winning branch selection: maintainer merges chosen attempt; issue automatically transitions to `MERGED` and target block updates cleanly on main branch.
- [x] **Issue Discussion & Review Comments (`issue_comments`)**:
  - [x] Threaded collaborative discussions directly inside issues.
  - [x] Wires up the system notification type `COMMENT_ADDED` to notify creators and assignees.

---

### Area 5: Tracking Changes (Version Control)
- [x] **Commit DAG Chain (`commits`)**:
  - [x] Git-like commit graph with `parent_commit_id` and `merge_parent_commit_id`.
  - [x] Content hashes generated from commit contents.
  - [x] Commit author attribution and descriptive commit messages.
- [x] **Ternary Commit Manifests (`commit_manifests`)**:
  - [x] Ternary relationship connecting `(commit_id × slot_id × version_id)`.
  - [x] O(1) single-query document assembly without walking diff trees.
- [x] **Interactive Commit DAG / Tree Visualizer**:
  - [x] Multi-lane graph separating main branch from issue branches.
  - [x] Interactive historical snapshot inspector: click any historical commit to view the exact document state at that moment in time.

---

## 2. Elite Level Additions

To establish BookWorm as an **elite, world-class note-sharing platform**, the following advanced features are integrated:

- [x] **Global Command Palette & Full-Text Search (`Ctrl+K`)**:
  - Instant keyboard-driven palette (`Ctrl+K` / `Cmd+K` or search bar click).
  - Real-time search across notebooks, notes, content text, and issues.
  - Category filtering and direct keyboard navigation.
- [x] **Block-Level History & Blame Inspector**:
  - Click "History" on any block in the note viewer to view its complete author revision trail.
  - Shows all past versions, author avatars, timestamps, and 1-click version restore.
- [x] **Hierarchical Block Indentation & Nesting (`parent_slot_id`)**:
  - Full support for `parent_slot_id` in the block editor and note viewer.
  - Visual hierarchy, child block indentation, and outline relationships.
- [x] **Enhanced Rich Block Types**:
  - **Callout / Alert Banners**: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION` with distinct color palettes and icons.
  - **Interactive Checklists / Task Lists**: Real-time todo items.
  - **Tables & Structured Code Blocks**: Formatted syntax with language badges.
- [x] **Public Explore & Community Discovery Showcase (`/explore`)**:
  - Public directory showcasing community-published notes and notebooks.
  - Filtering by search query, read times, and 1-click zero-cost forking for any signed-in user.
- [x] **Starred Notes & Bookmarks System (`user_starred_resources`)**:
  - Star / bookmark favorite notes and notebooks.
  - Dedicated "Starred" tab on dashboard for quick access.
- [x] **Automated LexoRank Rebalancing Engine**:
  - One-click or automated maintenance action to redistribute lexorank keys evenly across a note, guaranteeing perpetual O(1) insertion space.
- [x] **Multi-Format Note Export Suite**:
  - Export full notes to Markdown (`.md`), HTML preview, or print-optimized PDF.

---

## 3. Gap Analysis & Implementation Status Tracker

| Feature | Source | Status | Implemented In |
|---|---|---|---|
| **Users, Salted Auth, JWT Sessions** | `bookworm.md` Sec 3 | ✅ Complete | `src/actions/auth.ts` |
| **Resources ISA Hierarchy** | `bookworm.md` Sec 3, 10 | ✅ Complete | `final_sql_schema.sql` |
| **RBAC Collaborator Roles & Capabilities** | `bookworm.md` Sec 3 | ✅ Complete | `src/actions/permissions.ts` |
| **Access Request Workflow** | `bookworm.md` Sec 3 | ✅ Complete | `src/actions/permissions.ts` |
| **Notifications Hub** | Architecture Area 6 | ✅ Complete | `src/actions/notifications.ts` |
| **Notebooks & Notes CRUD** | `bookworm.md` Sec 4 | ✅ Complete | `src/actions/notebooks.ts`, `notes.ts` |
| **Named Editions & Public Reader** | `bookworm.md` Sec 4, 15 | ✅ Complete | `src/actions/editions.ts`, `src/app/e/` |
| **Main + Attempt Branches** | `bookworm.md` Sec 4, 10 | ✅ Complete | `src/actions/branches.ts` |
| **3-Layer Content Model (Slots/Versions/Blobs)** | `bookworm.md` Sec 5, 10 | ✅ Complete | `src/actions/blocks.ts`, `schema.sql` |
| **Content-Addressed Storage (SHA-256 CAS)** | `bookworm.md` Sec 5, 10 | ✅ Complete | `src/lib/hash.ts`, `content_blobs` |
| **LexoRank O(1) Block Midpoint Insertion** | `bookworm.md` Sec 5, 15 | ✅ Complete | `src/lib/lexorank.ts`, `blocks.ts` |
| **Drag-and-Drop Reordering & Splitting** | `bookworm.md` Sec 5 | ✅ Complete | `editor.tsx`, `blocks.ts` |
| **Block Locking (One Active Issue Per Slot)** | `bookworm.md` Sec 6, 15 | ✅ Complete | `issues`, `uq_one_active_issue_per_slot` |
| **Zero-Cost Forking** | `bookworm.md` Sec 5, 9 | ✅ Complete | `forkNote` in `src/actions/notes.ts` |
| **Ternary Commit Manifests & DAG Tree** | `bookworm.md` Sec 7, 10 | ✅ Complete | `tree-client.tsx`, `commits` |
| **Branch Diff & Merge Review** | `bookworm.md` Sec 6, 8 | ✅ Complete | `MergeReviewDiffModal.tsx` |
| **Issue Discussion & Comments** | Missing Feature (`COMMENT_ADDED`) | ✅ Complete | `src/actions/comments.ts` |
| **Hierarchical Blocks (`parent_slot_id`)** | Unfulfilled in `bookworm.md` Sec 5 | ✅ Complete | `src/actions/blocks.ts`, `NoteDetailPage` |
| **LexoRank Rebalancing Engine** | Unfulfilled in `bookworm.md` FAQ Q7 | ✅ Complete | `rebalanceNoteBlocks` in `blocks.ts` |
| **Global Search & Command Palette (`Ctrl+K`)** | Elite Platform Feature | ✅ Complete | `src/actions/search.ts`, `CommandPalette.tsx` |
| **Block Version History Inspector ("Blame")** | Elite Platform Feature | ✅ Complete | `src/actions/blocks.ts`, `BlockHistoryModal.tsx` |
| **Note Starring & Bookmarking** | Elite Platform Feature | ✅ Complete | `src/actions/stars.ts`, `dashboard-client.tsx` |
| **Public Community Explore Hub (`/explore`)** | Elite Platform Feature | ✅ Complete | `src/actions/explore.ts`, `src/app/explore/` |
| **Rich Block Callouts, Checklists & Tables** | Elite Platform Feature | ✅ Complete | `RobustMarkdown.tsx` |
