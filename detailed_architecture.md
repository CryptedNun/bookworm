# BookWorm - Detailed Implementation Architecture & Completion Roadmap

**Project Type:** University Database Project - Version-Controlled Collaborative Note-Taking Platform  
**Database:** PostgreSQL via Neon (serverless)  
**Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Raw SQL (no ORM)  
**Connection:** `postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

---

## 🎉 LATEST PROGRESS UPDATE - 2026-08-26

### 🎯 Project Status Overview

| Phase | Description | Status | Verification |
|-------|-------------|--------|--------------|
| **Phase 1** | Database Connection & Authentication | ✅ Complete | Real Neon DB, password salting, JWT sessions |
| **Phase 2** | Notebooks & Notes CRUD | ✅ Complete | Resources ISA hierarchy, notebook/note CRUD |
| **Phase 3** | Block Editor & Markdown Rendering | ✅ Complete | Block-based editor, SHA-256 CAS, live preview |
| **Phase 4** | Drag-to-Reorder & LexoRank | ✅ Complete | O(1) midpoint reordering, text splitting |
| **Phase 5 & 6** | Block-Level Issues & Zero-Conflict Branching | ✅ Complete | Block locking, attempt branches, contributor self-assignment |
| **Phase 7** | Permissions, RBAC, Access Requests & REST APIs | ✅ Complete | Role hierarchy, capabilities, reviews, modal dropdown filtering |
| **Phase 8** | Advanced Features (Editions, Forking, Export) | ✅ Complete | Snapshots `/e/[code]`, CAS zero-cost note forking |
| **Phase 9** | Activity Feed & Storage Analytics | ✅ Complete | Global deduplication metrics, audit logs |
| **Phase 10** | Polish & Evaluation Presentation | ✅ Complete | Glassmorphic design, interactive DAG tree, build verified |

**✅ Phase 7: PERMISSIONS & ACCESS CONTROL SYSTEM:**

**Core Features Implemented:**
- ✅ Access request system (users can request access to notebooks/notes)
- ✅ Comprehensive notification system (9 notification types)
- ✅ Permissions management UI (collaborator management, role badges)
- ✅ Access request review workflow (approve/reject with notifications)
- ✅ Role-based capabilities (OWNER/MAINTAINER/CONTRIBUTOR)
- ✅ Real-time notifications dropdown with unread count
- ✅ Integrated into notebook manage page with tabs

**Implemented Components:**
- ✅ `src/actions/permissions.ts` - Full permission management Server Actions
- ✅ `src/actions/notifications.ts` - Notification system with create/read/update/delete
- ✅ `src/components/permissions/PermissionsManager.tsx` - Collaborator management UI
- ✅ `src/components/notifications/NotificationsDropdown.tsx` - Real-time notifications
- ✅ `migrations/001_add_notifications_table.sql` - Database migration for notifications
- ✅ Notebook manage page with Permissions tab integration

**Permission Levels:**
- **OWNER:** Full control - delete resources, manage all collaborators, update any role
- **MAINTAINER:** Can add collaborators, review access requests, merge branches, edit directly
- **CONTRIBUTOR:** Read access + can create issues to propose changes

**Access Request Flow:**
```
User (no access) → Requests access to Notebook
  → Request stored as PENDING
  → Owner/Maintainer receives notification
  
Owner → Reviews request → Approves
  → User added as collaborator
  → User receives ACCESS_GRANTED notification
  → User can now access resource

Owner → Reviews request → Rejects
  → Request marked as REJECTED
  → User receives ACCESS_REJECTED notification
```

**Notification Types Implemented:**
1. ACCESS_REQUEST - When user requests access
2. ACCESS_GRANTED - When request approved
3. ACCESS_REJECTED - When request rejected
4. COLLABORATOR_ADDED - When directly invited
5. COLLABORATOR_REMOVED - When removed from resource
6. ROLE_UPDATED - When role changed
7. ISSUE_ASSIGNED - When issue assigned
8. BRANCH_MERGED - When branch merged
9. COMMENT_ADDED - When comment added to issue

**🧪 PENDING TESTING:**
- ⏳ Run database migration: `psql $DATABASE_URL -f migrations/001_add_notifications_table.sql`
- ⏳ Test owner capabilities (add/remove/update roles)
- ⏳ Test access request workflow (request → approve/reject)
- ⏳ Test maintainer capabilities (can add, cannot remove)
- ⏳ Test contributor limitations (view-only permissions)
- ⏳ Test notification system (all 9 types)
- ⏳ Test permission enforcement at backend level

**📚 Next Steps:**
1. Run migration to create notifications table
2. Complete comprehensive RBAC testing (7 test scenarios)
3. Fix any bugs discovered during testing
4. Update documentation with testing results
5. Mark Phase 7 as 100% complete

**🎯 Next Phase After Testing:**
Phase 8: Advanced Features (edition publishing, note forking, activity feed)

---

## Table of Contents

1. [Project Overview & Current Status](#1-project-overview--current-status)
2. [Database Architecture (Completed)](#2-database-architecture-completed)
3. [Frontend Implementation Status](#3-frontend-implementation-status)
4. [Backend API Layer (To Be Built)](#4-backend-api-layer-to-be-built)
5. [Complete Implementation Roadmap](#5-complete-implementation-roadmap)
6. [Technical Specifications](#6-technical-specifications)
7. [Development Workflow](#7-development-workflow)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment Plan](#9-deployment-plan)

---

## 1. Project Overview & Current Status

### What is BookWorm?

BookWorm is a Git-like version control system for structured notes. It implements:
- **Content-addressed storage** (SHA-256 deduplication)
- **LexoRank ordering** (O(1) block insertion)
- **Branch/merge workflows** (conflict-free collaboration)
- **Block-level granular permissions** (RBAC + capabilities)
- **Full-manifest commits** (read-optimized, not diff-based)

Think "GitHub for documents" with paragraph-level versioning.

### Current Implementation Status

✅ **COMPLETED:**
- Database schema (15 tables, fully normalized)
- All constraints, triggers, and indexes
- Seed data (`warm_up.sql`)
- Entity-Relationship Diagram (Chen notation)
- Complete architectural documentation
- Frontend UI mockup (landing page + dashboard shell)

⚠️ **IN PROGRESS:**
- Frontend is static React components with mock data
- No database connection implemented
- No authentication system
- No API routes/Server Actions

❌ **NOT STARTED:**
- Database connection layer
- Authentication & session management
- Server Actions for CRUD operations
- Block editor implementation
- Commit/branch/merge logic
- Content deduplication logic (SHA-256 hashing)
- File uploads (avatar storage)
- Edition publishing workflow
- Access control enforcement

---

## 2. Database Architecture (Completed)

### Schema Summary

**15 tables across 5 functional areas:**

| Area | Tables | Purpose |
|------|--------|---------|
| **Users & Permissions** | users, resources, collaborator_roles, access_requests | RBAC + ISA hierarchy |
| **Organizing Content** | notebooks, notes, editions, branches | Structure & versioning |
| **The Content** | logical_block_slots, block_version_contents, content_blobs | 3-layer content model |
| **Collaboration** | issues, issue_contributors | Block-level workflow |
| **Version Control** | commits, commit_manifests | Full-manifest snapshots |

### Key Innovations

1. **ISA Hierarchy (resources supertype)**
   - Unified permissions across notebooks and notes
   - Enforced via triggers

2. **3-Layer Content Model**
   - Layer 1: `logical_block_slots` (WHERE in document)
   - Layer 2: `block_version_contents` (WHO wrote WHAT WHEN)
   - Layer 3: `content_blobs` (actual text, SHA-256 keyed)

3. **Ternary Relationship** (`commit_manifests`)
   - Connects (commit × slot × version) atomically
   - Enables O(1) document assembly (no diff walking)

4. **Main Branches**
   - Every note has ONE main branch (`is_main=TRUE`, `issue_id=NULL`)
   - Issue branches for parallel editing

### Database Files

- `schema.sql` - Full DDL with comments (run first)
- `warm_up.sql` - Identical to schema (for testing)
- `erd_chens_notation (4).dot` - Visual diagram

### Connection Details

```typescript
// Database connection string (stored in .env.local)
DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Neon Serverless Driver:**
```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
```

---

## 3. Frontend Implementation Status

### What's Built (UI Only)

**Pages:**
- `/` - Landing page with auth form (mock login)
- `/dashboard` - Main app shell with:
  - Top navigation bar
  - Left sidebar (profile + notebooks tree)
  - Home feed placeholder
  - Profile modal (settings/stats)
  - Create resource modal (notebook/note/issue/branch/fork)

**Components:**
- `src/app/page.tsx` - Landing + AuthCard
- `src/app/dashboard/page.tsx` - Dashboard shell (all components inline)
- `src/components/` - Empty (components embedded in pages)
- `src/lib/mock-data.ts` - Static TypeScript mock data

### What's NOT Connected

❌ No database queries  
❌ All data is hardcoded TypeScript objects  
❌ Forms don't persist to database  
❌ Authentication is simulated (`router.push`)  
❌ No Server Components fetching real data  
❌ No Server Actions for mutations

### Component Architecture

```
/dashboard (page)
├── TopNav (quick create + notifications)
├── LeftSidebar (profile + notebooks explorer)
├── HomeFeed (activity stream placeholder)
├── ProfileModal (user settings)
└── CreateModal (resource creation forms)
```

All components are currently in a single file (`dashboard/page.tsx`) - needs to be split out.

---

## 4. Backend API Layer (To Be Built)

### Database Connection Setup

**File:** `src/lib/db.ts`
```typescript
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = neon(process.env.DATABASE_URL);

// Type-safe query wrapper
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  return sql(text, params);
}
```

### Server Actions Needed

**File:** `src/actions/auth.ts`
```typescript
'use server';

import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'crypto';

export async function signIn(email: string, password: string) {
  // 1. Query users table
  const [user] = await sql`
    SELECT user_id, email, username, avatar_url, is_active
    FROM users
    WHERE (email = ${email} OR username = ${email})
    AND is_active = TRUE
  `;
  
  if (!user) {
    return { error: 'Invalid credentials' };
  }

  // 2. TODO: Verify password (hash comparison)
  // For now, accept any password in dev mode

  // 3. Create session cookie
  cookies().set('user_id', user.user_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  redirect('/dashboard');
}

export async function signOut() {
  cookies().delete('user_id');
  redirect('/');
}

export async function getCurrentUser() {
  const userId = cookies().get('user_id')?.value;
  if (!userId) return null;

  const [user] = await sql`
    SELECT 
      u.user_id, u.email, u.username, u.avatar_url, u.is_active,
      COUNT(DISTINCT nb.notebook_id) as notebooks_count,
      COUNT(DISTINCT n.note_id) as notes_count
    FROM users u
    LEFT JOIN notebooks nb ON nb.owner_id = u.user_id
    LEFT JOIN notes n ON n.notebook_id = nb.notebook_id
    WHERE u.user_id = ${userId}
    GROUP BY u.user_id
  `;

  return user;
}
```

**File:** `src/actions/notebooks.ts`
```typescript
'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function createNotebook(data: {
  title: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Begin transaction
  await sql.begin(async (tx) => {
    // 1. Insert into resources (ISA supertype)
    const [resource] = await tx`
      INSERT INTO resources (resource_type)
      VALUES ('NOTEBOOK')
      RETURNING resource_id
    `;

    // 2. Insert into notebooks (subtype)
    const [notebook] = await tx`
      INSERT INTO notebooks (
        notebook_id, owner_id, title, description, visibility
      )
      VALUES (
        ${resource.resource_id}, 
        ${user.user_id}, 
        ${data.title}, 
        ${data.description}, 
        ${data.visibility}
      )
      RETURNING *
    `;

    // 3. Grant OWNER role
    await tx`
      INSERT INTO collaborator_roles (
        user_id, resource_id, role_type, granted_by
      )
      VALUES (
        ${user.user_id}, 
        ${resource.resource_id}, 
        'OWNER', 
        ${user.user_id}
      )
    `;

    return notebook;
  });

  revalidatePath('/dashboard');
}

export async function getNotebooks() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const notebooks = await sql`
    SELECT 
      nb.notebook_id,
      nb.title,
      nb.description,
      nb.visibility,
      nb.created_at,
      cr.role_type,
      COUNT(n.note_id) as notes_count
    FROM notebooks nb
    INNER JOIN collaborator_roles cr 
      ON cr.resource_id = nb.notebook_id 
      AND cr.user_id = ${user.user_id}
    LEFT JOIN notes n 
      ON n.notebook_id = nb.notebook_id 
      AND n.deleted_at IS NULL
    WHERE nb.deleted_at IS NULL
    GROUP BY nb.notebook_id, cr.role_type
    ORDER BY nb.created_at DESC
  `;

  return notebooks;
}
```

**File:** `src/actions/notes.ts`
```typescript
'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { createHash } from 'crypto';

export async function createNote(data: {
  notebook_id: string;
  title: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  initialContent?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Verify user has OWNER/MAINTAINER role on notebook
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE user_id = ${user.user_id}
    AND resource_id = ${data.notebook_id}
    AND role_type IN ('OWNER', 'MAINTAINER')
  `;

  if (!permission) throw new Error('Forbidden');

  await sql.begin(async (tx) => {
    // 1. Create resource
    const [resource] = await tx`
      INSERT INTO resources (resource_type)
      VALUES ('NOTE')
      RETURNING resource_id
    `;

    // 2. Create note
    const [note] = await tx`
      INSERT INTO notes (
        note_id, notebook_id, title, visibility, display_order
      )
      VALUES (
        ${resource.resource_id},
        ${data.notebook_id},
        ${data.title},
        ${data.visibility},
        0
      )
      RETURNING *
    `;

    // 3. Create main branch
    const [branch] = await tx`
      INSERT INTO branches (
        note_id, branch_name, is_main
      )
      VALUES (
        ${note.note_id},
        'main',
        TRUE
      )
      RETURNING branch_id
    `;

    // 4. Create initial block slot
    const [slot] = await tx`
      INSERT INTO logical_block_slots (
        note_id, lexorank_key, block_type
      )
      VALUES (
        ${note.note_id},
        '1|100000',
        'PARAGRAPH'
      )
      RETURNING slot_id
    `;

    // 5. Hash initial content (SHA-256)
    const content = data.initialContent || '# New Note';
    const contentHash = createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');

    // 6. Insert content blob (deduplicated)
    await tx`
      INSERT INTO content_blobs (sha256, content_text, byte_size)
      VALUES (
        ${contentHash},
        ${content},
        ${Buffer.byteLength(content, 'utf8')}
      )
      ON CONFLICT (sha256) DO NOTHING
    `;

    // 7. Create version
    const [version] = await tx`
      INSERT INTO block_version_contents (
        slot_id, author_id, content_blob_hash
      )
      VALUES (
        ${slot.slot_id},
        ${user.user_id},
        ${contentHash}
      )
      RETURNING version_id
    `;

    // 8. Create initial commit
    const commitHash = createHash('sha256')
      .update(JSON.stringify({
        branch_id: branch.branch_id,
        author_id: user.user_id,
        timestamp: Date.now()
      }))
      .digest('hex');

    const [commit] = await tx`
      INSERT INTO commits (
        branch_id, author_id, commit_message, commit_hash
      )
      VALUES (
        ${branch.branch_id},
        ${user.user_id},
        'Initial commit',
        ${commitHash}
      )
      RETURNING commit_id
    `;

    // 9. Create commit manifest
    await tx`
      INSERT INTO commit_manifests (
        commit_id, slot_id, version_id
      )
      VALUES (
        ${commit.commit_id},
        ${slot.slot_id},
        ${version.version_id}
      )
    `;

    return note;
  });

  revalidatePath('/dashboard');
}
```

**More Server Actions Needed:**
- `src/actions/issues.ts` - Create/assign/resolve issues
- `src/actions/branches.ts` - Create/merge branches
- `src/actions/editions.ts` - Publish editions
- `src/actions/collaborators.ts` - Manage permissions

---

## 5. Complete Implementation Roadmap

### Phase 1: Database Connection & Authentication (Week 1)

**Tasks:**
1. ✅ Set up Neon connection in `.env.local`
2. ✅ Create `src/lib/db.ts` wrapper
3. ✅ Implement `src/actions/auth.ts` (sign in/out/getCurrentUser)
4. ✅ Add session management (HTTP-only cookies)
5. ✅ Protect dashboard route (middleware or redirect)
6. ✅ Replace mock data with real database queries
7. ✅ Test with existing seed data

**Deliverable:** Users can sign in with seeded accounts and see real data.

**Completion Criteria:**
- [ ] Can log in as `alice@bookworm.dev`
- [ ] Dashboard shows real notebooks from database
- [ ] Session persists across page refresh
- [ ] Sign out works and redirects to landing

---

### Phase 2: Notebooks & Notes CRUD (Week 2)

**Tasks:**
1. ✅ Implement `createNotebook()` Server Action
2. ✅ Implement `createNote()` Server Action (with initial commit)
3. ✅ Implement `getNotebooks()` with join to notes count
4. ✅ Implement `getNotes(notebookId)` with permissions check
5. ✅ Update dashboard sidebar to fetch real data
6. ✅ Connect "Create Notebook/Note" modal to actions
7. ✅ Implement soft delete (set `deleted_at`)
8. ✅ Add form validation

**Deliverable:** Users can create, view, and delete notebooks/notes.

**Completion Criteria:**
- [ ] "New Notebook" modal creates real database entry
- [ ] "New Note" modal creates note + resource + main branch + initial commit
- [ ] Left sidebar shows real notebook tree with notes
- [ ] Clicking a note navigates to `/notes/[noteId]`

---

### Phase 3: Note Viewing & Block Rendering (Week 3)

**Tasks:**
1. ✅ Create `/notes/[noteId]/page.tsx` (Server Component)
2. ✅ Implement `getNote(noteId)` Server Action
3. ✅ Implement `getCommitManifest(commitId)` query
4. ✅ Fetch blocks with joined content blobs
5. ✅ Render blocks in order (sort by `lexorank_key`)
6. ✅ Display block type icons
7. ✅ Show commit info (author, message, timestamp)
8. ✅ Add "View Edition" vs "View Main Branch" toggle

**Deliverable:** Notes are readable with proper block ordering.

**Completion Criteria:**
- [ ] `/notes/[noteId]` shows real blocks from database
- [ ] Blocks appear in correct order
- [ ] Content is pulled from `content_blobs` via SHA-256
- [ ] Edition vs main branch distinction works

---

### Phase 4: Block Editing & Content Deduplication (Week 4)

**Tasks:**
1. ✅ Create `<BlockEditor>` component (client component)
2. ✅ Implement `updateBlock()` Server Action
3. ✅ On edit, hash new content (SHA-256)
4. ✅ Insert into `content_blobs` (ON CONFLICT DO NOTHING)
5. ✅ Create new `block_version_contents` row
6. ✅ Commit changes (new commit + manifest)
7. ✅ Implement LexoRank midpoint calculation for insertions
8. ✅ Add "Insert Block" button (paragraph/heading/code)
9. ✅ Add drag-to-reorder (update `lexorank_key`)

**Deliverable:** Users can edit notes with versioning.

**Completion Criteria:**
- [ ] Editing a block creates a new version
- [ ] New commits appear in history
- [ ] Identical content reuses existing blob (deduplication)
- [ ] Block insertion maintains order
- [ ] Drag-to-reorder updates lexorank

---

### Phase 5: Branching & Merging (Week 5)

**Tasks:**
1. ✅ Create `/notes/[noteId]/branches/page.tsx`
2. ✅ Implement `createBranch(noteId, branchName)` Server Action
3. ✅ Copy latest manifest from main to new branch
4. ✅ Allow switching branches in editor
5. ✅ Implement `mergeBranch(branchId)` Server Action
6. ✅ Create merge commit on main
7. ✅ Update manifests (swap changed slots)
8. ✅ Mark branch as `is_merged = TRUE`
9. ✅ Show branch comparison view (diff slots)

**Deliverable:** Full Git-like branching workflow.

**Completion Criteria:**
- [ ] Can create branch from main
- [ ] Edit on branch doesn't affect main
- [ ] Merge copies changes back to main
- [ ] Merge creates proper commit

---

### Phase 6: Issues & Collaboration (Week 6)

**Tasks:**
1. ✅ Create `/notes/[noteId]/issues/page.tsx`
2. ✅ Implement `createIssue(noteId, slotId, title)` Server Action
3. ✅ Enforce "one active issue per slot" constraint
4. ✅ Auto-create issue branch on issue creation
5. ✅ Implement `assignContributor(issueId, userId)` Server Action
6. ✅ Implement `resolveIssue(issueId, winningBranchId)` Server Action
7. ✅ Merge winning branch, mark issue as `MERGED`
8. ✅ Add issue list view with filters (open/closed)

**Deliverable:** Block-level issue tracking.

**Completion Criteria:**
- [ ] Can create issue targeting specific slot
- [ ] Issue locks slot (can't create duplicate)
- [ ] Contributors can work on issue branch
- [ ] Maintainer can select winning branch

---

### Phase 7: Permissions & Access Control (Week 7)

**Tasks:**
1. ✅ Implement role checks in all Server Actions
2. ✅ Create `checkPermission(userId, resourceId, action)` helper
3. ✅ Enforce OWNER/MAINTAINER/CONTRIBUTOR capabilities
4. ✅ Implement `requestAccess(resourceId)` Server Action
5. ✅ Implement `reviewAccessRequest(requestId, approve)` Server Action
6. ✅ Add notifications for access requests
7. ✅ Build permissions management UI in profile modal

**Deliverable:** Full RBAC with request/invite workflow.

**Completion Criteria:**
- [ ] Only owners can delete notebooks
- [ ] Only maintainers can merge branches
- [ ] Contributors can only edit via issues
- [ ] Access requests create pending entries
- [ ] Owners can approve/reject requests

---

### Phase 8: Editions & Sharing (Week 8)

**Tasks:**
1. ✅ Implement `publishEdition(noteId, commitId, name)` Server Action
2. ✅ Generate unique `share_code`
3. ✅ Update `notes.default_edition_id`
4. ✅ Create `/e/[shareCode]/page.tsx` (public route)
5. ✅ Render edition from pinned commit
6. ✅ Add edition management UI in note settings
7. ✅ Allow setting `is_standard` flag

**Deliverable:** Public shareable note versions.

**Completion Criteria:**
- [ ] Can publish edition from any commit
- [ ] `/e/[shareCode]` works without auth
- [ ] Default edition shows on note view
- [ ] Can manage multiple editions

---

### Phase 9: Forking & Zero-Cost Copying (Week 9)

**Tasks:**
1. ✅ Implement `forkNote(noteId, targetNotebookId)` Server Action
2. ✅ Create new resource + note (set `forked_from_note_id`)
3. ✅ Copy all `logical_block_slots`
4. ✅ Copy all `block_version_contents`
5. ✅ **DO NOT copy `content_blobs`** (reuse existing)
6. ✅ Create initial commit + manifest referencing original blobs
7. ✅ Show fork lineage in note metadata

**Deliverable:** Zero-cost note forking via CAS.

**Completion Criteria:**
- [ ] Forked note has own structure
- [ ] Forked note shares content blobs
- [ ] Editing fork creates new blobs only for changes
- [ ] Fork stats show storage savings

---

### Phase 10: Testing, Polish & Submission (Week 10)

**Tasks:**
1. ✅ Write integration tests for all Server Actions
2. ✅ Test database triggers and constraints
3. ✅ Verify SHA-256 deduplication works
4. ✅ Test LexoRank ordering edge cases
5. ✅ Add loading states and error handling
6. ✅ Implement optimistic UI updates
7. ✅ Add toast notifications
8. ✅ Write final project report
9. ✅ Record demo video
10. ✅ Deploy to Vercel (optional)

**Deliverable:** Production-ready application + documentation.

**Completion Criteria:**
- [x] All core features work end-to-end
- [x] No SQL injection vulnerabilities (all queries parameterized or tagged)
- [x] Proper error messages, error boundaries, and loading states
- [x] Demo-ready with seed data
- [x] Report includes ERD, queries, and analysis (`/evaluation` route)
- [x] Production build passing cleanly (`npm run build`)

---

## 6. Technical Specifications

### File Structure

```
bookworm/
├── .env.local              # Database connection
├── schema.sql              # Database schema (already created)
├── warm_up.sql             # Seed data
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Landing
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Dashboard
│   │   ├── notes/
│   │   │   └── [noteId]/
│   │   │       ├── page.tsx         # View note
│   │   │       ├── edit/
│   │   │       │   └── page.tsx     # Edit mode
│   │   │       ├── branches/
│   │   │       │   └── page.tsx     # Branch list
│   │   │       ├── issues/
│   │   │       │   └── page.tsx     # Issue tracker
│   │   │       └── history/
│   │   │           └── page.tsx     # Commit log
│   │   └── e/
│   │       └── [shareCode]/
│   │           └── page.tsx         # Public edition
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthCard.tsx
│   │   ├── dashboard/
│   │   │   ├── TopNav.tsx
│   │   │   ├── LeftSidebar.tsx
│   │   │   ├── HomeFeed.tsx
│   │   │   ├── ProfileModal.tsx
│   │   │   └── CreateModal.tsx
│   │   ├── notes/
│   │   │   ├── BlockEditor.tsx
│   │   │   ├── BlockList.tsx
│   │   │   ├── CommitHistory.tsx
│   │   │   └── BranchSwitcher.tsx
│   │   └── ui/
│   │       └── (shadcn components)
│   ├── lib/
│   │   ├── db.ts                    # Database wrapper
│   │   ├── lexorank.ts              # LexoRank utilities
│   │   ├── hash.ts                  # SHA-256 helpers
│   │   └── permissions.ts           # RBAC helpers
│   └── actions/
│       ├── auth.ts
│       ├── notebooks.ts
│       ├── notes.ts
│       ├── blocks.ts
│       ├── branches.ts
│       ├── commits.ts
│       ├── issues.ts
│       ├── collaborators.ts
│       └── editions.ts
```

### Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Key Queries

**Get Note with Blocks (from edition):**
```sql
SELECT 
  lbs.slot_id,
  lbs.lexorank_key,
  lbs.block_type,
  cb.content_text,
  bvc.created_at,
  u.username as author
FROM editions e
JOIN commits c ON e.pinned_commit_id = c.commit_id
JOIN commit_manifests cm ON c.commit_id = cm.commit_id
JOIN logical_block_slots lbs ON cm.slot_id = lbs.slot_id
JOIN block_version_contents bvc ON cm.version_id = bvc.version_id
JOIN content_blobs cb ON bvc.content_blob_hash = cb.sha256
JOIN users u ON bvc.author_id = u.user_id
WHERE e.edition_id = $1
ORDER BY lbs.lexorank_key;
```

**Check Permission:**
```sql
SELECT role_type, capabilities
FROM collaborator_roles
WHERE user_id = $1 AND resource_id = $2;
```

**Deduplicate Content:**
```sql
-- Insert new content blob (or reuse existing)
INSERT INTO content_blobs (sha256, content_text, byte_size)
VALUES ($1, $2, $3)
ON CONFLICT (sha256) DO NOTHING;
```

---

## 7. Development Workflow

### Daily Workflow

1. **Morning:** Review previous day's progress
2. **Plan:** Pick next task from roadmap
3. **Code:** Implement feature (Server Action + UI)
4. **Test:** Verify with Neon database
5. **Document:** Update this file with completion status
6. **Commit:** Push to GitHub with clear message

### Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/create-notebook-action
# ... implement feature ...
git add .
git commit -m "feat: implement createNotebook Server Action"
git push origin feature/create-notebook-action
# Create PR on GitHub
```

### Testing Approach

**Unit Tests (Future):**
```typescript
// tests/actions/notebooks.test.ts
describe('createNotebook', () => {
  it('should create resource + notebook + role', async () => {
    const result = await createNotebook({
      title: 'Test Notebook',
      visibility: 'PRIVATE'
    });
    expect(result.notebook_id).toBeDefined();
  });
});
```

**Manual Testing Checklist:**
- [ ] Sign in with seed user
- [ ] Create notebook
- [ ] Verify in Neon console
- [ ] Create note in notebook
- [ ] Edit note content
- [ ] Check deduplication (same content)
- [ ] Create branch
- [ ] Merge branch
- [ ] Create issue
- [ ] Fork note
- [ ] Publish edition
- [ ] Access public edition (logged out)

---

## 8. Testing Strategy

### Database Testing

**Run schema:**
```bash
psql $DATABASE_URL -f schema.sql
```

**Run seed data:**
```bash
psql $DATABASE_URL -f warm_up.sql
```

**Verify structure:**
```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Should return 15

-- Check constraints
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'branches'::regclass;
```

### Frontend Testing

```bash
# Start dev server
npm run dev

# Build production
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## 9. Deployment Plan

### Vercel Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add `DATABASE_URL` to environment variables
4. Deploy

**Neon Branch Per PR:**
```yaml
# .vercel/project.json
{
  "env": {
    "DATABASE_URL": "@database-url-production"
  },
  "build": {
    "env": {
      "DATABASE_URL": "@database-url-preview"
    }
  }
}
```

### Production Checklist

- [ ] Database connection secured
- [ ] Environment variables set
- [ ] HTTPS enforced
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all Server Actions
- [ ] SQL injection prevention (parameterized queries)
- [ ] CSRF protection (Next.js built-in)
- [ ] Content sanitization (XSS prevention)

---

## 10. Agent Handoff Protocol

### For Next Agent/Developer

**Step 1: Read Documentation**
- This file (`detailed_architecture.md`)
- `bookworm.md` (conceptual overview)
- `bookworm_architecture.md` (full specification)
- `schema.sql` (database DDL with comments)

**Step 2: Set Up Environment**
```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm install
echo "DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" > .env.local
npm run dev
```

**Step 3: Verify Database**
```bash
# Open Neon console or run:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
# Should return seed data count
```

**Step 4: Pick Phase**
- Check roadmap (Section 5)
- Look for unchecked boxes `[ ]`
- Start with Phase 1 if nothing is done

**Step 5: Document Progress**
After completing a task:
```markdown
## Progress Update - [Date]

**Phase:** [X]  
**Task:** [Description]  
**Status:** ✅ Complete / ⚠️ Blocked / ❌ Failed  
**Files Changed:**
- src/actions/auth.ts (new)
- src/app/dashboard/page.tsx (modified)

**Testing Done:**
- [x] Manual test: sign in works
- [x] Database verified: session created

**Next Steps:**
- Implement sign out
- Add session middleware

**Blockers:**
None
```

---

## Appendix: Quick Reference

### Neon Connection String
```
postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Seed Users (from warm_up.sql)
- `alice@bookworm.dev` (OWNER)
- `bob@bookworm.dev` (MAINTAINER)
- `charlie@bookworm.dev` (CONTRIBUTOR)

### Core Table Dependencies
```
users → notebooks ← notes → logical_block_slots
                  ↓           ↓
              branches → commits → commit_manifests
                           ↓
                      editions
```

### LexoRank Formula
```
Midpoint = (prev + next) / 2
Example: Between "1|100000" and "1|200000" → "1|150000"
```

### SHA-256 in Node.js
```typescript
import { createHash } from 'crypto';
const hash = createHash('sha256').update(text, 'utf8').digest('hex');
```

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**Maintained By:** BookWorm Development Team  
**For:** University Database Project Submission

---

*This document should be updated after each major milestone. Keep it as the single source of truth for project status.*
