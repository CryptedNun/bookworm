# BookWorm - Agent Handoff & Development Guide

**Project:** BookWorm - Git-like Version Control for Structured Notes  
**Type:** University Database Project  
**Stack:** Next.js 15, TypeScript, PostgreSQL (Neon), No ORM (Raw SQL)  
**Status:** Database Complete, Frontend UI Complete, Backend Not Implemented

---

## 🎯 Quick Start for New Agents

### 1. Essential Reading (in order)
1. `HUMAN_TASKS.md` - **READ FIRST** - What agents CAN'T do & how to request help
2. `detailed_architecture.md` - **START HERE** - Complete roadmap & current status
3. `bookworm_architecture.md` - Full technical specification
4. `bookworm.md` - Conceptual overview & design philosophy
5. `schema.sql` - Database DDL with inline documentation
6. `erd_chens_notation (4).dot` - Visual database diagram

### 2. Environment Setup
```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm install  # 🚨 HUMAN TASK - Agent cannot run this
cp .env.local.example .env.local  # Already exists with connection string
npm run dev  # 🚨 HUMAN TASK - Requires persistent terminal
```

**⚠️ If these fail:** See `HUMAN_TASKS.md` Section 1 for what the user needs to do.

### 3. Database Connection
**Already configured in `.env.local`:**
```
DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Test connection:**
```bash
# Option 1: Direct query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Option 2: View in Neon console
# https://console.neon.tech
```

---

## 🚨 Requesting Human Action

### When You Need the User to Do Something

Some tasks are **impossible for agents** to perform. When you encounter these:

**✅ DO THIS:**
```markdown
🚨 **HUMAN ACTION REQUIRED**

**Task:** [Reference from HUMAN_TASKS.md, e.g., "Task 1.1: Install Dependencies"]
**Why:** [Explain the reason]
**What I need you to do:**

1. [Step-by-step instructions]
2. [Step-by-step instructions]
3. [Step-by-step instructions]

**Verify it worked:**
```bash
[Command to verify]
```

**What to tell me after:**
> "✅ Task completed. [What to report back]"

⏸️ **I am paused and cannot continue until you complete this.**
```

**❌ DON'T DO THIS:**
- Don't try to work around limitations
- Don't pretend you can run commands
- Don't skip verification steps
- Don't continue without confirmation

### Common Tasks That Require Human Action

**Always require human:**
- Running `npm install` or `npm run dev`
- Testing in browser (clicking buttons, filling forms)
- Viewing browser console errors
- Deploying to Vercel
- Creating GitHub repositories
- Running `psql` commands
- Installing system packages

**Agents CAN do:**
- Write code (Server Actions, components, utilities)
- Create/modify files
- Provide SQL queries (human runs them)
- Design architecture
- Debug from logs/output provided by human
- Suggest solutions

**Reference:** See `HUMAN_TASKS.md` for complete list with step-by-step instructions.

---

## 📋 Current Project Status

### ✅ Completed
- [x] Database schema (15 tables, fully normalized)
- [x] All constraints, triggers, indexes
- [x] Seed data with test users & notebooks
- [x] ERD diagram (Chen notation)
- [x] Complete documentation (3 architecture docs)
- [x] Frontend UI mockup (landing + dashboard)
- [x] Component structure (all inline in pages for now)

### ⚠️ In Progress
- [ ] Database connection layer (`src/lib/db.ts` - needs creation)
- [ ] Server Actions (all need implementation)
- [ ] Authentication system (mock login currently)

### ❌ Not Started
- [ ] Real database queries
- [ ] Session management
- [ ] CRUD operations
- [ ] Block editor
- [ ] Branch/merge logic
- [ ] Content deduplication (SHA-256)
- [ ] Permissions enforcement
- [ ] Edition publishing
- [ ] Note forking

---

## 🚀 Implementation Roadmap

### Priority Order (See `detailed_architecture.md` for full breakdown)

**Phase 1: Database Connection & Auth** (Week 1)
- Create `src/lib/db.ts` with Neon wrapper
- Implement `src/actions/auth.ts` (signIn, signOut, getCurrentUser)
- Add session cookies
- Protect dashboard route
- Replace mock data with real queries

**Phase 2: Notebooks & Notes CRUD** (Week 2)
- Create/read notebooks
- Create/read notes (with initial commit + main branch)
- Update dashboard to use real data
- Implement soft delete

**Phase 3-10:** See `detailed_architecture.md` Section 5

---

## 🏗️ Architecture Overview

### Database (PostgreSQL via Neon)

**15 Tables in 5 Functional Areas:**
1. **Users & Permissions** - RBAC with ISA hierarchy
2. **Organizing Content** - Notebooks, notes, editions, branches
3. **The Content** - 3-layer model (slots → versions → blobs)
4. **Collaboration** - Issues, contributors
5. **Version Control** - Commits, manifests

**Key Innovations:**
- **ISA Hierarchy:** `resources` supertype for unified permissions
- **3-Layer Content:** Structure (WHERE) + Versions (WHO/WHEN) + Storage (WHAT)
- **Content-Addressed Storage:** SHA-256 deduplication (zero-cost forking)
- **LexoRank Ordering:** O(1) block insertion between any two blocks
- **Ternary Relationship:** `commit_manifests` links (commit × slot × version)
- **Main Branches:** Every note has one main branch, issues spawn temp branches

### Frontend (Next.js 15 App Router)

**Current Structure:**
```
src/
├── app/
│   ├── page.tsx                    # Landing (mock auth)
│   └── dashboard/
│       └── page.tsx                # Dashboard shell (all components inline)
├── components/
│   ├── auth/                       # AuthCard (needs extraction)
│   └── dashboard/                  # Sidebar, TopNav, etc. (needs extraction)
└── lib/
    └── mock-data.ts               # Static data (TO BE REPLACED)
```

**Needs Restructuring:**
- Extract inline components from `dashboard/page.tsx`
- Create `src/actions/` directory
- Create `src/lib/db.ts`
- Add route protection middleware

---

## 🔧 Development Guidelines

### Code Style
- **TypeScript strict mode:** All code must type-check
- **Server Actions:** Use `'use server'` directive
- **Database queries:** Raw SQL with `@neondatabase/serverless`
- **No ORM:** This is a database course project, show SQL knowledge
- **Comments:** Explain WHY, not WHAT (especially for complex queries)

### Database Patterns

**✅ Good - Parameterized queries:**
```typescript
const [user] = await sql`
  SELECT * FROM users 
  WHERE email = ${email}
`;
```

**❌ Bad - String concatenation:**
```typescript
const user = await sql(`SELECT * FROM users WHERE email = '${email}'`);
// SQL injection vulnerability!
```

**✅ Good - Transaction for multi-table inserts:**
```typescript
await sql.transaction(async (tx) => {
  const [resource] = await tx`INSERT INTO resources ...`;
  const [notebook] = await tx`INSERT INTO notebooks ...`;
  await tx`INSERT INTO collaborator_roles ...`;
});
```

### Content Deduplication Pattern

**Always hash before insert:**
```typescript
import { createHash } from 'crypto';

const contentHash = createHash('sha256')
  .update(text, 'utf8')
  .digest('hex');

// Insert with ON CONFLICT DO NOTHING (deduplication)
await sql`
  INSERT INTO content_blobs (sha256, content_text, byte_size)
  VALUES (${contentHash}, ${text}, ${Buffer.byteLength(text, 'utf8')})
  ON CONFLICT (sha256) DO NOTHING
`;
```

### LexoRank Pattern

**Insert between two blocks:**
```typescript
function calculateMidpoint(prev: string, next: string): string {
  // prev = "1|100000", next = "1|200000"
  // Extract numeric parts and average
  const prevNum = parseInt(prev.split('|')[1]);
  const nextNum = parseInt(next.split('|')[1]);
  const mid = Math.floor((prevNum + nextNum) / 2);
  return `1|${mid.toString().padStart(6, '0')}`;
}
```

---

## 📝 Documentation Requirements

### After Each Completed Task

**Update `detailed_architecture.md`:**
```markdown
## Progress Update - 2026-08-26

**Phase:** 1 - Database Connection & Auth  
**Task:** Implemented signIn Server Action  
**Status:** ✅ Complete  

**Files Changed:**
- src/lib/db.ts (new)
- src/actions/auth.ts (new)
- .env.local (updated)

**Testing:**
- [x] Manual: Can sign in as alice@bookworm.dev
- [x] Database: Session cookie created
- [x] Error handling: Shows "Invalid credentials"

**Next Steps:**
- Implement signOut action
- Add middleware for route protection

**Blockers:**
None
```

### Git Commit Messages

**Format:** `type(scope): description`

**Examples:**
```bash
feat(auth): implement signIn Server Action
fix(dashboard): resolve sidebar data loading
docs(architecture): update Phase 1 status
refactor(components): extract TopNav from dashboard
test(notes): add createNote integration test
```

**Types:** feat, fix, docs, refactor, test, chore

---

## 🧪 Testing Checklist

### Manual Testing Workflow

**After implementing any Server Action:**
1. Test in browser (happy path)
2. Test error cases (invalid input)
3. Verify database state (Neon console or psql)
4. Check logs for SQL errors
5. Test permissions (try as different users)

**Example: Testing createNotebook:**
```bash
# 1. Sign in as alice
# 2. Click "New Notebook"
# 3. Fill form, submit
# 4. Verify in Neon:
psql $DATABASE_URL -c "
  SELECT nb.title, r.resource_type, cr.role_type
  FROM notebooks nb
  JOIN resources r ON r.resource_id = nb.notebook_id
  JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id
  WHERE nb.title = 'Test Notebook';
"
# Should show: resource_type=NOTEBOOK, role_type=OWNER
```

### Database Integrity Tests

**Run after schema changes:**
```sql
-- Test ISA constraint
INSERT INTO resources (resource_type) VALUES ('NOTEBOOK');
-- Should succeed

INSERT INTO notebooks (notebook_id, owner_id, title)
VALUES ('invalid-uuid', 'user-uuid', 'Test');
-- Should fail (no matching resource)

-- Test block locking constraint
-- Create two issues targeting same slot
-- Second should fail with unique constraint violation
```

---

## 🛠️ Common Tasks & Snippets

### Add a New Server Action

**File:** `src/actions/example.ts`
```typescript
'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function exampleAction(data: { field: string }) {
  // 1. Authenticate
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // 2. Validate input
  if (!data.field) throw new Error('Field required');

  // 3. Check permissions (if needed)
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE user_id = ${user.user_id}
    AND resource_id = ${resourceId}
  `;
  if (!permission) throw new Error('Forbidden');

  // 4. Execute database operation
  const [result] = await sql`
    INSERT INTO table_name (field)
    VALUES (${data.field})
    RETURNING *
  `;

  // 5. Revalidate affected pages
  revalidatePath('/dashboard');

  return result;
}
```

### Add a New Page

**File:** `src/app/example/page.tsx`
```typescript
import { getCurrentUser } from '@/actions/auth';
import { sql } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function ExamplePage() {
  // Server Component - fetch data directly
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const data = await sql`
    SELECT * FROM table_name
    WHERE user_id = ${user.user_id}
  `;

  return (
    <main>
      {/* Render data */}
    </main>
  );
}
```

### Add a Client Component with Server Action

**File:** `src/components/example/Form.tsx`
```typescript
'use client';

import { exampleAction } from '@/actions/example';
import { useState } from 'react';

export function ExampleForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      field: formData.get('field') as string
    };

    try {
      await exampleAction(data);
      alert('Success!');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="field" required />
      <button disabled={loading}>Submit</button>
    </form>
  );
}
```

---

## 🚨 Common Pitfalls & How to Avoid

### 1. Forgetting ISA Resource Creation
**Problem:** Creating note without resource entry first  
**Solution:** Always use transactions and create resource first
```typescript
await sql.transaction(async (tx) => {
  const [resource] = await tx`INSERT INTO resources (resource_type) VALUES ('NOTE') RETURNING resource_id`;
  const [note] = await tx`INSERT INTO notes (note_id, ...) VALUES (${resource.resource_id}, ...)`;
});
```

### 2. Skipping Main Branch on Note Creation
**Problem:** Note created without initial branch/commit  
**Solution:** Note creation = resource + note + branch + slot + blob + version + commit + manifest (all in one transaction)

### 3. Not Hashing Content Before Insert
**Problem:** Duplicate content stored multiple times  
**Solution:** Always compute SHA-256 first, use ON CONFLICT DO NOTHING

### 4. Breaking LexoRank Invariants
**Problem:** Inserting block with wrong lexorank  
**Solution:** Always calculate midpoint, never hardcode values

### 5. Missing Permission Checks
**Problem:** Anyone can edit any notebook  
**Solution:** Check collaborator_roles in every Server Action

---

## 🔗 External Resources

### Documentation Links
- **Next.js 15 Docs:** https://nextjs.org/docs
- **Neon Docs:** https://neon.tech/docs
- **Neon Serverless Driver:** https://github.com/neondatabase/serverless
- **PostgreSQL 16 Docs:** https://www.postgresql.org/docs/16/

### Project-Specific Docs
- `bookworm.md` - Conceptual overview (45 min read)
- `bookworm_architecture.md` - Full spec (60 min read)
- `detailed_architecture.md` - Implementation guide (30 min read)
- `schema.sql` - Annotated database DDL

### Useful SQL References
- Composite Foreign Keys: https://www.postgresql.org/docs/16/ddl-constraints.html#DDL-CONSTRAINTS-FK
- Partial Unique Indexes: https://www.postgresql.org/docs/16/indexes-partial.html
- Triggers: https://www.postgresql.org/docs/16/trigger-definition.html

---

## 📞 Contact & Handoff

### When Passing to Next Agent

**Checklist:**
1. [ ] Push all changes to GitHub
2. [ ] Update `detailed_architecture.md` with progress
3. [ ] Document any blockers encountered
4. [ ] Leave TODO comments in code for unfinished work
5. [ ] Update this file (AGENTS.md) if workflow changed

**Handoff Message Template:**
```markdown
## Handoff - [Your Name] to [Next Agent]

**Date:** [Date]  
**Phase Completed:** [X]  
**Status:** [% Complete]

**What's Working:**
- [List features that work]

**Known Issues:**
- [List bugs or incomplete features]

**Next Priority:**
- [What should be done next]

**Environment Notes:**
- [Any setup quirks or gotchas]

**Files to Review:**
- [Key files to understand]
```

---

## 🎓 Learning Resources (for Database Course Context)

### Key Database Concepts Demonstrated

1. **ISA Hierarchy:** Resources → Notebooks/Notes (Section 4.2 in bookworm_architecture.md)
2. **Ternary Relationship:** commit_manifests (commit × slot × version)
3. **Content-Addressed Storage:** SHA-256 primary keys
4. **Composite Foreign Keys:** Enforcing cross-table invariants
5. **Partial Unique Indexes:** Business rules as constraints
6. **Triggers:** Maintaining referential integrity beyond FKs
7. **Transaction Isolation:** Multi-table inserts with ACID guarantees

### SQL Query Patterns Worth Studying

**Recursive CTE (commit history):**
```sql
WITH RECURSIVE commit_chain AS (
  SELECT commit_id, parent_commit_id, commit_message, 0 as depth
  FROM commits
  WHERE commit_id = $1
  
  UNION ALL
  
  SELECT c.commit_id, c.parent_commit_id, c.commit_message, cc.depth + 1
  FROM commits c
  INNER JOIN commit_chain cc ON c.commit_id = cc.parent_commit_id
  WHERE cc.depth < 100
)
SELECT * FROM commit_chain ORDER BY depth;
```

**Aggregate with GROUP BY (notebook stats):**
```sql
SELECT 
  nb.notebook_id,
  nb.title,
  COUNT(DISTINCT n.note_id) as notes_count,
  COUNT(DISTINCT c.commit_id) as total_commits
FROM notebooks nb
LEFT JOIN notes n ON n.notebook_id = nb.notebook_id
LEFT JOIN branches b ON b.note_id = n.note_id
LEFT JOIN commits c ON c.branch_id = b.branch_id
GROUP BY nb.notebook_id;
```

**Subquery (check permission):**
```sql
SELECT * FROM notes
WHERE note_id = $1
AND EXISTS (
  SELECT 1 FROM collaborator_roles
  WHERE resource_id = notes.note_id
  AND user_id = $2
);
```

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**For:** Agent-to-Agent Handoff & New Developer Onboarding

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
