# BookWorm Platform Features & Technical Architecture Guide

**Project:** BookWorm — Git-like Version Control for Structured Notes  
**Technology Stack:** Next.js 15 (App Router, Turbopack), TypeScript (Strict Mode), PostgreSQL (Neon Serverless), No ORM (Raw SQL via `@neondatabase/serverless`), Content-Addressed Storage (SHA-256), Vanilla CSS & Tailwind Engine.

---

## 📑 Table of Contents

1. [Platform Overview & Core Philosophy](#1-platform-overview--core-philosophy)
2. [Identity, Authentication & Session Security](#2-identity-authentication--session-security)
3. [Access Control, RBAC Matrix & Permissions](#3-access-control-rbac-matrix--permissions)
4. [Notebooks & Notes Hierarchical Organization](#4-notebooks--notes-hierarchical-organization)
5. [The Content Model: 3-Layer Storage & Content-Addressed Storage (CAS)](#5-the-content-model-3-layer-storage--content-addressed-storage-cas)
6. [LexoRank Ordering & Dynamic Block Editing](#6-lexorank-ordering--dynamic-block-editing)
7. [Issue-Centric Collaboration & Zero-Conflict Branching](#7-issue-centric-collaboration--zero-conflict-branching)
8. [Commit History, DAG Version Control & 3-Way Merge](#8-commit-history-dag-version-control--3-way-merge)
9. [Editions: Immutable Publishing & Public Sharing](#9-editions-immutable-publishing--public-sharing)
10. [Zero-Cost Content-Addressed Note Forking](#10-zero-cost-content-addressed-note-forking)
11. [Collaborative Discussion & Commenting Threads](#11-collaborative-discussion--commenting-threads)
12. [Notifications Engine & Event Lifecycle](#12-notifications-engine--event-lifecycle)
13. [Bookmarks & Star System](#13-bookmarks--star-system)
14. [Storage Analytics & Unified Activity Feeds](#14-storage-analytics--unified-activity-feeds)
15. [Public Discovery (`/explore`) & Live Architecture Evaluation (`/evaluation`)](#15-public-discovery-explore--live-architecture-evaluation-evaluation)
16. [REST API Layer](#16-rest-api-layer)

---

## 1. Platform Overview & Core Philosophy

BookWorm is a university database systems engineering project designed to bring the distributed version control guarantees of Git to structured, modular, block-based documents.

### The Core Problem with Document Collaboration
Traditional collaborative document systems (like Google Docs or Notion) rely on Operational Transformation (OT) or Conflict-free Replicated Data Types (CRDTs). While convenient for concurrent keystroke typing, they lack true version control features:
- Historical commit graphs (DAGs)
- Fine-grained block isolation
- Intentional code/text reviews before merging
- Mathematical deduplication across iterations

### The BookWorm Solution
BookWorm re-imagines document management through three database-enforced principles:
1. **Zero-Conflict by Construction:** Instead of attempting to reconcile colliding edits on arbitrary lines of text, collaboration is centered around block slots locked by open issues.
2. **Content-Addressed Storage (CAS):** Document text is stored by the cryptographic SHA-256 digest of its contents. Deduplication is enforced at the database level (`ON CONFLICT (sha256) DO NOTHING`), enabling instant, zero-storage-cost note forks.
3. **Pure Raw SQL Execution:** Built without an ORM (no Prisma, Drizzle, or TypeORM), utilizing relational modeling: composite foreign keys, partial unique indexes, database-level triggers, recursive Common Table Expressions (CTEs), and strict ACID transactions.

---

## 2. Identity, Authentication & Session Security

- **Implementation:** `src/actions/auth.ts`, `src/middleware.ts`
- **Tables:** `users`

### Features:
- **Salted Password Hashing:** Passwords are never stored in plaintext. Passwords use cryptographic salting and hashing (`crypto.pbkdf2Sync` with SHA-256 and unique 16-byte random salts).
- **Session Management:** Stateless, secure HTTP-only cookies (`session_user_id`, `session_username`) set with `SameSite=Lax` and path restrictions.
- **Route Protection:** Handled via Next.js Middleware. Direct navigation to protected routes (`/dashboard`, `/dashboard/*`) automatically redirects unauthenticated users to `/` with an expiration toast query parameter (`?session=expired`).
- **Profile Management:** Users can view their internal BookWorm User UUID, copy it to their clipboard with one click, update their display name, and view personal contribution statistics.

---

## 3. Access Control, RBAC Matrix & Permissions

- **Implementation:** `src/actions/permissions.ts`, `src/lib/permissions.ts`, `src/components/permissions/PermissionsManager.tsx`
- **Tables:** `resources`, `collaborator_roles`, `access_requests`

### The ISA Hierarchy Supertype (`resources`)
BookWorm uses an **ISA Inheritance Hierarchy** in PostgreSQL:
- A base table `resources (resource_id UUID PRIMARY KEY, resource_type TEXT NOT NULL)` acts as the abstract supertype.
- `notebooks` and `notes` are concrete subtypes referencing `resources(resource_id)` with `ON DELETE CASCADE`.
- The `collaborator_roles` table points to `resources(resource_id)`, allowing a unified permission checking engine across notebooks and notes.

### Role Capabilities Matrix

| Capability | OWNER | MAINTAINER | CONTRIBUTOR | VIEWER / PUBLIC |
| :--- | :---: | :---: | :---: | :---: |
| **Delete Resource (Soft/Hard)** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Remove Collaborators** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Change Collaborator Roles** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Invite New Collaborators** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Approve / Reject Access Requests** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Create New Notes in Notebook** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Reorder Notes in Notebook** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Direct Edit on `main` Branch** | ✅ Yes *(if not locked)* | ✅ Yes *(if not locked)* | ❌ No | ❌ No |
| **Open Issues (Locks Target Block)** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Submit Attempt Branch on Issue** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Commit on Own Attempt Branch** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Review & 3-Way Merge Branches** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Publish Snapshot Editions** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Set Default Note Edition** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Fork Note to Writable Notebook** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Star Notes / Notebooks** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes *(if signed in)* |
| **View Collaborator List** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes *(if accessible)* |
| **Request Access to Resource** | N/A | N/A | N/A | ✅ Yes |

### Resource Visibility Rules
Every notebook and note has a `visibility` attribute:
1. **`PUBLIC`**:
   - **Who can see it?** Any authenticated user and any unauthenticated public visitor.
   - **Discoverability:** Listed in the public `/explore` directory and accessible via direct link.
   - **Forking:** Anyone can fork public notes into their own notebooks.
2. **`UNLISTED`**:
   - **Who can see it?** Anyone with the direct URL.
   - **Discoverability:** Excluded from the `/explore` directory. Ideal for sharing drafts with peer reviewers without exposing them publicly.
3. **`PRIVATE`**:
   - **Who can see it?** Strictly restricted to the resource `OWNER` and users explicitly granted a role in `collaborator_roles`.
   - Unauthorized attempts return `403 Forbidden` or redirect safely to `/dashboard`.

### Access Request & Invitation Workflow
- Non-members browsing an accessible notebook can click **"Request Access"** inside the permissions manager.
- The user selects their desired role (`CONTRIBUTOR` or `MAINTAINER`) and writes an optional message.
- A record is created in `access_requests` with status `PENDING`.
- An `ACCESS_REQUEST` notification is automatically dispatched to the notebook owner and maintainers.
- Owners and Maintainers can review pending requests, clicking **Approve** (which inserts a role into `collaborator_roles` and creates an `ACCESS_GRANTED` notification) or **Reject** (`ACCESS_REJECTED` notification).

---

## 4. Notebooks & Notes Hierarchical Organization

- **Implementation:** `src/actions/notebooks.ts`, `src/actions/notes.ts`, `src/app/dashboard/notebooks/[notebookId]/manage/page.tsx`
- **Tables:** `notebooks`, `notes`

### Notebook Features:
- **Hierarchical Grouping:** Notebooks serve as workspaces containing ordered sequences of notes (chapters/sections).
- **Atomic Creation:** Creating a notebook executes an ACID transaction:
  1. Inserts into `resources` (`resource_type = 'NOTEBOOK'`).
  2. Inserts into `notebooks` (`notebook_id`, `owner_id`, `title`, `description`, `visibility`).
  3. Inserts into `collaborator_roles` granting `OWNER` role to the creator.
- **Soft Deletion:** Deleting a notebook sets `deleted_at = now()`, preventing data loss while excluding it from active queries.

### Note Features:
- **Initial Bootstrap Transaction:** Creating a note creates the complete version control infrastructure in a single database transaction:
  1. `resources` record (`resource_type = 'NOTE'`)
  2. `notes` record (`note_id`, `notebook_id`, `title`, `visibility`, `display_order`)
  3. Initial `branches` record (`is_main = true, branch_name = 'main'`)
  4. Initial `logical_block_slots` record (heading block for the title)
  5. Initial `content_blobs` record (hashed initial text)
  6. Initial `block_version_contents` record
  7. Initial `commits` record (`commit_hash`, `commit_message = 'Initial note creation'`)
  8. Initial `commit_manifests` record linking `(commit_id, slot_id, version_id)`
  9. Initial standard `editions` record (`v1.0.0`)
- **Drag-to-Reorder Notes:** Maintainers and owners can reorder notes inside a notebook using `updateNoteOrder`, dynamically updating `notes.display_order`.

---

## 5. The Content Model: 3-Layer Storage & Content-Addressed Storage (CAS)

- **Implementation:** `src/actions/blocks.ts`, `src/lib/hash.ts`
- **Tables:** `logical_block_slots`, `block_version_contents`, `content_blobs`

BookWorm's content engine separates documents into three distinct database layers:

```
[Layer 1: WHERE]   logical_block_slots (slot_id, note_id, lexorank_key, block_type)
                            │
                            ▼
[Layer 2: WHO/WHEN] block_version_contents (version_id, author_id, created_at, content_blob_hash)
                            │
                            ▼
[Layer 3: WHAT]    content_blobs (sha256 [PRIMARY KEY], content_text, byte_size)
```

### 1. Spatial Layer: `logical_block_slots`
- Identifies **WHERE** a block exists in the document and its structural semantic type.
- Retains a persistent `slot_id` UUID even as its content changes across revisions.

### 2. Version Attribution Layer: `block_version_contents`
- Identifies **WHO** edited the block and **WHEN**.
- Stores `version_id`, `author_id`, `created_at`, and a foreign key pointing to `content_blobs(sha256)`.

### 3. Physical Storage Layer: `content_blobs` (Content-Addressed Storage)
- Identifies **WHAT** the block contains.
- Primary key is the **SHA-256 cryptographic hash** of the UTF-8 content string:
  ```typescript
  const contentHash = createHash('sha256').update(text, 'utf8').digest('hex');
  ```
- **Database-Level Deduplication:**
  ```sql
  INSERT INTO content_blobs (sha256, content_text, byte_size)
  VALUES ($1, $2, $3)
  ON CONFLICT (sha256) DO NOTHING;
  ```
  If 100 notes or branches contain the exact same paragraph or markdown snippet, it is stored **only once** on disk.

---

## 6. LexoRank Ordering & Dynamic Block Editing

- **Implementation:** `src/lib/lexorank.ts`, `src/actions/blocks.ts`, `src/app/dashboard/notebooks/[notebookId]/notes/[noteId]/edit/editor.tsx`

### LexoRank Ordering Invariant
Instead of integer indices (which require reindexing all subsequent rows on every insertion $O(N)$), BookWorm utilizes **LexoRank string ordering**:
- Every block has a `lexorank_key` (e.g. `1|100000`, `1|200000`).
- To insert a new block between blocks $A$ and $B$, the system calculates the mid-point string in $O(1)$:
  $$\text{MidPoint}(`1|100000`, `1|200000`) \implies `1|150000`$$
- Supported operations:
  - **Insert Block Anywhere:** Append or insert above/below any block with $O(1)$ database cost.
  - **Drag-to-Reorder Blocks:** Dragging a block calculates a new midpoint between its new neighbors without touching any other row in the database.

### Text Splitting & Multi-Block Conversions
- When typing in a paragraph, highlighting a portion of text and selecting a special format (e.g. **Code Block**, **Blockquote**, **Heading**) automatically splits the block:
  1. Top text remains in the current block.
  2. Selected text is extracted into a new block slot formatted as Code/Quote/Heading with a midpoint LexoRank key.
  3. Bottom remaining text is placed in a third block slot.
- **Manifest Safeguard:** Prevents block drops by querying commits that enforce `EXISTS (SELECT 1 FROM commit_manifests)` and running an atomic slot backfill.

### Supported Block Types:
- `PARAGRAPH` — Standard body text with markdown inline bold, italics, links, and code spans.
- `HEADING_1`, `HEADING_2`, `HEADING_3` — Structured hierarchical document headers.
- `CODE` — Syntax-highlighted code blocks with language tagging and one-click copy button.
- `QUOTE` — Stylized blockquotes for citations and callouts.
- `CALLOUT` — Emphasized note boxes with visual tints for tips, warnings, and notes.
- `MATH` — Mathematical equations rendered via KaTeX.

---

## 7. Issue-Centric Collaboration & Zero-Conflict Branching

- **Implementation:** `src/actions/issues.ts`, `src/actions/branches.ts`, `src/app/dashboard/notebooks/[notebookId]/notes/[noteId]/issues/`
- **Tables:** `issues`, `branches`

BookWorm replaces free-form concurrent editing with structured, issue-based task collaboration.

```
                  ┌──────────────────────────────────────────────┐
                  │                 MAIN BRANCH                  │
                  │  (Block 1)   [Block 2: LOCKED]   (Block 3)   │
                  └──────────────────────┬───────────────────────┘
                                         │ Issue Created on Block 2
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
       ┌────────────────────────┐                ┌────────────────────────┐
       │   ATTEMPT BRANCH A     │                │   ATTEMPT BRANCH B     │
       │   (User: Alice)        │                │   (User: Bob)          │
       │   Modifies Block 2     │                │   Modifies Block 2     │
       └────────────┬───────────┘                └────────────┬───────────┘
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         │ Maintainer Reviews & Merges Winning Branch
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │                 MAIN BRANCH                  │
                  │  (Block 1)   [Block 2: UPDATED]  (Block 3)   │
                  │              (Lock Released)                 │
                  └──────────────────────────────────────────────┘
```

### Key Collaboration Invariants:

#### 1. Block Locking via Issues
- An issue always targets a specific block slot (`target_slot_id`).
- **Single Active Issue Per Block Constraint:** Database unique index prevents multiple active issues from competing on the same block:
  ```sql
  CREATE UNIQUE INDEX uq_active_issue_per_slot
  ON issues (target_slot_id)
  WHERE status IN ('OPEN', 'IN_PROGRESS');
  ```
- **Who can open an issue?** Only `OWNER` or `MAINTAINER` can create an issue. Contributors browse open issues and submit proposed fixes.

#### 2. Universal Block Locking on `main`
- While an issue is active (`OPEN` or `IN_PROGRESS`), **no one (not even the Notebook Owner or Maintainer)** can directly edit that block on the `main` branch.
- In `src/actions/blocks.ts`, any direct `updateBlock`, `splitBlock`, or `deleteBlock` call on `main` targeting a locked slot is rejected.
- In the editor UI, the block displays a lock banner: `🔒 Locked by Active Issue: "[title]"` with a direct `"Work on Issue Branch"` button.

#### 3. Branching Constraint (`chk_main_xor_attempt`)
Every branch in the database must strictly obey this XOR constraint:
```sql
CONSTRAINT chk_main_xor_attempt CHECK (
    (is_main = TRUE  AND issue_id IS NULL     AND attempted_by IS NULL
                      AND is_merged = FALSE    AND selected_by IS NULL)
    OR
    (is_main = FALSE AND issue_id IS NOT NULL AND attempted_by IS NOT NULL)
)
```
- Every note has exactly one `main` branch (`is_main = true`).
- All other branches **must be an attempt branch attached to an open issue** and linked to the user who attempted it.

#### 4. Who Can Contribute to an Issue?
- `CONTRIBUTOR`, `MAINTAINER`, and `OWNER` can all contribute!
- Calling `contributeToIssue(issueId)` creates an isolated attempt branch (`issue-{id}/{title}`) with an initial commit mirroring `main`.
- Multiple users can independently attempt the same issue on separate attempt branches without stepping on each other's work.

---

## 8. Commit History, DAG Version Control & 3-Way Merge

- **Implementation:** `src/actions/branches.ts`, `src/actions/blocks.ts`
- **Tables:** `commits`, `commit_manifests`

### The Ternary Commit Manifest (`commit_manifests`)
Rather than storing whole-document snapshots or delta diffs, BookWorm links commits to blocks via a **ternary relationship**:
$$\text{commit\_manifests} \subseteq \text{commits} \times \text{logical\_block\_slots} \times \text{block\_version\_contents}$$
- Each commit points to a list of exact `(slot_id, version_id)` pairs.
- If an edit only modifies Block #3 in a 50-block note, the new commit manifest reuses the version IDs of the other 49 blocks, incurring near-zero storage overhead.

### Recursive CTE Commit History
Commit histories form a Directed Acyclic Graph (DAG) queried using PostgreSQL Recursive CTEs:
```sql
WITH RECURSIVE commit_chain AS (
  SELECT commit_id, parent_commit_id, commit_message, 0 as depth
  FROM commits WHERE commit_id = $1
  UNION ALL
  SELECT c.commit_id, c.parent_commit_id, c.commit_message, cc.depth + 1
  FROM commits c
  INNER JOIN commit_chain cc ON c.commit_id = cc.parent_commit_id
  WHERE cc.depth < 100
)
SELECT * FROM commit_chain ORDER BY depth;
```

### Visual Branch Comparison (Diff Engine)
Maintainers can visually compare any attempt branch against `main` before merging:
- Identifies blocks that are `added`, `modified`, `deleted`, or `unchanged`.
- Shows side-by-side text diffs and cryptographic CAS hashes.

### 3-Way Merge Engine
- **Who can merge?** Only `OWNER` or `MAINTAINER`.
- Finds the common ancestor commit between `main` and the attempt branch.
- Computes the 3-way merge manifest across all slots.
- Creates a merge commit on `main` with two parent commit pointers (`parent_commit_id` and `merge_parent_commit_id`).
- Marks the attempt branch as merged: `is_merged = true, selected_by = user_id, selected_at = now()`.
- Updates the issue status to `MERGED` and unlocks the block slot.
- Automatically dispatches notifications to contributors.

---

## 9. Editions: Immutable Publishing & Public Sharing

- **Implementation:** `src/actions/editions.ts`, `src/app/e/[shareCode]/`
- **Tables:** `editions`

```
  Note Revision DAG (main) ───[Commit A]───[Commit B]───[Commit C]
                                                │
                                                ▼
                                    Published Edition "v1.0"
                                     Pinned to Commit B
                                     Share Code: /e/distributed-systems-v1
```

### What is an Edition?
An **Edition** is an immutable, published snapshot of a note pinned to an exact commit hash. Similar to a book edition or software release tag, subsequent edits to the note on `main` will **never alter** a published edition.

### Edition Attributes:
- `edition_id` (UUID Primary Key)
- `note_id` (Parent Note)
- `edition_name` (e.g. `"v1.0 — Peer Reviewed Release"`, `"Draft 2"`)
- `share_code` (URL-safe unique public identifier, e.g. `raft-consensus-v1`)
- `pinned_commit_id` (Foreign key to `commits(commit_id)`)
- `is_standard` (Boolean indicating if this is the canonical edition)

### Who Can Publish & Manage Editions?
- **Publishing:** Only `OWNER` and `MAINTAINER` can publish an edition (`publishEdition`).
- **Default / Standard Edition:**
  - Marking `isStandard: true` sets `notes.default_edition_id = edition_id`.
  - When readers open the note in read mode, BookWorm displays the pinned standard edition.
  - Maintainers can switch the default edition at any time.
- **Deletion:** Only `OWNER` and `MAINTAINER` can delete an edition.

### Zero-Login Public Edition Reader (`/e/[shareCode]`):
Anyone with the public share link can view the document without an account:
- **Clean Typography:** Full responsive layout with light/dark theme support.
- **Export Markdown:** One-click download of the document as a `.md` file.
- **Print / PDF:** Optimized `@media print` styles for clean paper/PDF export.
- **CAS Proof of Authenticity:** Displays the exact Git-style commit hash and block SHA-256 addresses proving content authenticity.
- **Forking from Edition:** Readers can click **"Fork Note"** to clone that exact snapshot into their own BookWorm account.

---

## 10. Zero-Cost Content-Addressed Note Forking

- **Implementation:** `src/actions/notes.ts` (`forkNote`), `src/components/notes/ForkNoteModal.tsx`
- **Tables:** `notes`, `logical_block_slots`, `block_version_contents`, `commit_manifests`

### What is Note Forking?
Forking clones a note and all its block contents into another notebook. The newly created note retains provenance tracking via `notes.forked_from_note_id`.

### Who Can Fork a Note?
- **Source Note:** Any user who has read access to the note (public note, unlisted with URL, or collaborator).
- **Destination Notebook:** The user must be an `OWNER` or `MAINTAINER` of the destination notebook.

### How to Fork:
1. From the **Dashboard**: Click **"New"** $\to$ **"Fork Note"** $\to$ select source notebook, source note, destination notebook, and title.
2. From the **Note Reader**: Click the **"Fork Note"** button in the header toolbar.
3. From the **Public Edition Page (`/e/[shareCode]`)**: Click **"Fork Note"** in the top navigation bar.

### Why Forking Has "Zero Storage Cost"
In traditional databases, copying a 50,000-word document duplicates 50,000 words on disk. In BookWorm:
1. New `logical_block_slots` are created for the new note.
2. New `block_version_contents` are created pointing to the **existing** `content_blobs(sha256)` records.
3. A new initial commit and commit manifest are recorded.
4. **Result:** Exactly $0$ new text bytes are written to `content_blobs`. The fork is instantaneous and storage cost is near zero.

---

## 11. Collaborative Discussion & Commenting Threads

- **Implementation:** `src/actions/comments.ts`, `src/components/issues/IssueComments.tsx`
- **Tables:** `issue_comments`

### Features:
- **Threaded Issue Discussions:** Users collaborating on an issue can leave feedback, code review comments, and architectural suggestions.
- **Who can comment?** Any user with access to view the note (`OWNER`, `MAINTAINER`, `CONTRIBUTOR`).
- **Author Attribution:** Comments display author avatar, username, system badge (`OWNER`, `MAINTAINER`, `CONTRIBUTOR`), and relative timestamp.
- **Notification Trigger:** Adding a comment automatically creates a `COMMENT_ADDED` notification for the issue creator and active branch contributors.
- **Delete / Edit Comments:** Authors can delete their own comments; owners can moderate any comment.

---

## 12. Notifications Engine & Event Lifecycle

- **Implementation:** `src/actions/notifications.ts`, `src/components/notifications/NotificationsDropdown.tsx`
- **Tables:** `notifications`

### 9 Distinct System Notification Types:
1. `ACCESS_REQUEST` — User requested collaborator access to a notebook.
2. `ACCESS_GRANTED` — Maintainer/Owner approved access request.
3. `ACCESS_REJECTED` — Access request was declined.
4. `COLLABORATOR_ADDED` — User directly invited as collaborator.
5. `COLLABORATOR_REMOVED` — User removed from collaborator list.
6. `ROLE_UPDATED` — Collaborator role changed (e.g. Contributor promoted to Maintainer).
7. `ISSUE_ASSIGNED` — User assigned to or mentioned in an issue.
8. `BRANCH_MERGED` — Contributor's attempt branch was chosen and merged into `main`.
9. `COMMENT_ADDED` — New comment posted on an active issue thread.

### UI Features:
- Real-time notification bell dropdown in the top dashboard navigation.
- Glowing unread indicator badge.
- One-click **"Mark All as Read"** and individual notification dismissal.
- Actionable deep-links navigating directly to the relevant notebook, note, or issue.

---

## 13. Bookmarks & Star System

- **Implementation:** `src/actions/stars.ts`, `src/actions/notebooks.ts`, `src/actions/notes.ts`, `src/components/notes/StarButton.tsx`
- **Tables:** `user_starred_resources`

### Features:
- **Universal Staring:** Authenticated users can star any accessible notebook or note.
- **Live Counter Badges:** Displays real-time star counts on dashboard notebook cards, note cards, and reader headers.
- **Optimistic UI Updates:** Toggling a star updates the UI and counter instantly while saving to the database in the background.
- **Personal Bookmarks List:** Starred resources are indexed and accessible for quick navigation from the dashboard.

---

## 14. Storage Analytics & Unified Activity Feeds

- **Implementation:** `src/actions/dashboard.ts`, `src/components/dashboard/StorageAndActivityWidget.tsx`

### CAS Storage Engine Analytics:
- **Unique Content Blobs:** Number of distinct SHA-256 blobs stored in `content_blobs`.
- **Physical Stored Bytes:** Exact bytes consumed by unique blobs.
- **Raw Document Bytes:** Virtual bytes represented across all historical versions and forks.
- **Deduplication Ratio & Storage Savings:** Real-time calculation showing storage savings (e.g. `2.4x storage efficiency`, saving `58%` disk space).

### Unified Real-Time Activity Feed:
Aggregates activity into a single chronologically sorted feed:
- 🔵 **Commits:** Author snapshot commitments on branches.
- 🟢 **Editions:** Published immutable public releases.
- 🟡 **Issues:** Tasks opened, assigned, or merged.

### Unmerged Branches Review Widget:
- Prominently alerts maintainers and owners when attempt branches are waiting for review and merge across any of their managed notebooks.
- Direct links to the 3-way diff comparison and merge interface.

---

## 15. Public Discovery (`/explore`) & Live Architecture Evaluation (`/evaluation`)

### 1. Public Community Discovery (`/explore`)
- **Route:** `/explore`
- **Implementation:** `src/app/explore/page.tsx`, `src/actions/explore.ts`
- Showcases all community-created `PUBLIC` notebooks, notes, and published editions.
- Card previews featuring block counts, author badges, and direct links to public readers.

### 2. Live Academic & System Evaluation Dashboard (`/evaluation`)
- **Route:** `/evaluation`
- **Implementation:** `src/app/evaluation/page.tsx`, `src/actions/evaluation.ts`
- Designed specifically for university database course evaluation:
  - **Live Database Metrics:** Total row counts across all 15 normalized tables.
  - **Relational Integrity Constraint Audits:** Verifies the ISA resource hierarchy, active block locking partial index, and branch XOR invariants.
  - **SQL Query Showcase:** Demonstrates recursive CTE commit graph queries, ternary relationship manifests, and aggregations.

---

## 16. REST API Layer

BookWorm includes a full REST API for programmatic access, integrations, and automated pipelines:

| Method | Endpoint | Description | Access Requirement |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Create a new user account | Public |
| `POST` | `/api/auth/login` | Authenticate and receive session cookie | Public |
| `POST` | `/api/auth/logout` | Invalidate active session cookie | Authenticated |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & stats | Authenticated |
| `GET` | `/api/notebooks` | List all notebooks accessible to user | Authenticated |
| `POST` | `/api/notebooks` | Create a new notebook | Authenticated |
| `GET` | `/api/notebooks/:id` | Fetch notebook metadata & child notes | Authenticated / Public |
| `GET` | `/api/notes/:id` | Fetch note details, branch & edition info | Authenticated / Public |
| `GET` | `/api/issues` | Query issues by note ID or status | Authenticated / Public |
| `POST` | `/api/issues` | Open a new issue locking a block slot | OWNER / MAINTAINER |
| `POST` | `/api/branches/:id/merge` | Execute 3-way merge of attempt branch into `main` | OWNER / MAINTAINER |

---

## 17. Summary Checklist of User Permissions & Capabilities

```
Q: Who can see a notebook?
A: Anyone if PUBLIC; anyone with the link if UNLISTED; only OWNER and invited collaborators if PRIVATE.

Q: Who can create a note?
A: Only the notebook OWNER and MAINTAINERs.

Q: Who can edit a block directly on main?
A: OWNER and MAINTAINERs, provided there is NO active issue currently locking that block.

Q: Who can open an issue?
A: Only the OWNER and MAINTAINERs. Opening an issue locks the target block slot from direct edits on main.

Q: Who can contribute to / submit a version on an issue?
A: Anyone with access to the note (CONTRIBUTOR, MAINTAINER, OWNER). Calling contributeToIssue creates an isolated attempt branch.

Q: Who can commit on an issue?
A: The author who created that attempt branch.

Q: Who can merge an issue branch?
A: Only the OWNER and MAINTAINERs. Merging executes a 3-way merge into main, unlocks the block, and marks the issue as MERGED.

Q: What is an Edition?
A: An immutable, published snapshot of a note pinned to a specific commit hash, accessible via a public share link (/e/shareCode).

Q: How is an edition picked as the default?
A: Maintainers/owners mark is_standard = true during publishing or set notes.default_edition_id. Readers viewing the note see this canonical edition.

Q: Who can fork a note?
A: Anyone who can view the note can fork it into any destination notebook where they are an OWNER or MAINTAINER.

Q: How does forking work without wasting storage?
A: CAS (Content-Addressed Storage) reuses the identical SHA-256 content blob hashes in content_blobs without duplicating any text bytes.
```
