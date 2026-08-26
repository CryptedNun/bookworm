# BookWorm - Claude AI Development Reference

**For AI assistants (Claude, GPT, etc.) working on this project**

---

## 📚 Required Reading Order

Before writing ANY code, read these files in this exact order:

1. **`HUMAN_TASKS.md`** - **CRITICAL** - What you CANNOT do & how to request help
2. **`AGENTS.md`** - Start here for quick onboarding
3. **`detailed_architecture.md`** - Complete implementation roadmap
4. **`bookworm_architecture.md`** - Full technical specification
5. **`bookworm.md`** - Conceptual overview & design philosophy
6. **`schema.sql`** - Database DDL (read comments inline)

---

## ⚠️ Critical: Agent Limitations

### What You CANNOT Do

As an AI agent, you **cannot:**

❌ Run terminal commands (`npm install`, `npm run dev`, `psql`)  
❌ Open browser or interact with UI  
❌ Access external services (Neon console, Vercel dashboard, GitHub UI)  
❌ Install system packages  
❌ Test forms by clicking buttons  
❌ View browser console errors  
❌ Deploy applications  
❌ Run persistent processes  

### What You CAN Do

✅ Write code (TypeScript, React components, Server Actions)  
✅ Create and modify files  
✅ Design architecture and suggest solutions  
✅ Provide SQL queries (user runs them)  
✅ Explain complex concepts  
✅ Debug from logs/output provided by user  
✅ Review code and suggest improvements  

### When You Need User Action

**Use this template:**

```markdown
🚨 **HUMAN ACTION REQUIRED**

**Task:** [Reference HUMAN_TASKS.md section]
**Why:** [Brief explanation]
**Steps:**
1. [Exact command or action]
2. [Exact command or action]

**Verify:**
```bash
[Verification command]
```

**Report back:**
> "✅ [What to tell me]"

⏸️ **Paused until completion.**
```

**Full instructions:** See `HUMAN_TASKS.md` for all scenarios.

---

## 🎯 Your Role

You are working on a **university database course project**. The requirements are:

✅ **Must Have:**
- Raw SQL queries (no ORM) to demonstrate SQL knowledge
- All 15 database tables properly connected
- Proper use of constraints, triggers, and indexes
- Transaction handling for multi-table operations
- Complex queries (joins, subqueries, aggregates, CTEs)

❌ **Must NOT Have:**
- ORMs (Prisma, Drizzle, TypeORM, etc.)
- Auto-generated queries
- Simplified schema
- Missing constraints

**Why this matters:** The professor is grading SQL knowledge, not framework knowledge.

---

## 🚀 Current Project State

### What's Done
- ✅ Complete database schema (15 tables)
- ✅ All constraints, triggers, indexes
- ✅ Seed data with test users
- ✅ Frontend UI mockup (React components)
- ✅ Full documentation (3 architecture docs)

### What's NOT Done
- ❌ Database connection layer
- ❌ Server Actions (all CRUD operations)
- ❌ Authentication system
- ❌ Real database queries
- ❌ Content deduplication logic
- ❌ Branch/merge implementation
- ❌ Permissions enforcement

**You are implementing the backend from scratch.**

---

## 🔧 Technical Stack

### Approved Technologies
- **Database:** PostgreSQL 16 (via Neon serverless)
- **Backend:** Next.js 15 Server Actions
- **Driver:** `@neondatabase/serverless` (already installed)
- **Language:** TypeScript (strict mode)
- **Queries:** Raw SQL with template literals

### Connection String
```typescript
// Stored in .env.local (already configured)
DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Database Wrapper Pattern
```typescript
// src/lib/db.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Use tagged template literals for parameterized queries
const [user] = await sql`
  SELECT * FROM users 
  WHERE email = ${email}
`;
```

---

## 📖 Key Architecture Concepts

### 1. ISA Hierarchy (Resources Supertype)
```
        resources (supertype)
           /  \
          /    \
    notebooks  notes (subtypes)
```

**Why:** Unified permissions. Both notebooks and notes ARE resources.

**Implementation Pattern:**
```typescript
// Always create resource first (transaction)
await sql.transaction(async (tx) => {
  const [resource] = await tx`
    INSERT INTO resources (resource_type)
    VALUES ('NOTEBOOK')
    RETURNING resource_id
  `;
  
  const [notebook] = await tx`
    INSERT INTO notebooks (notebook_id, owner_id, title)
    VALUES (${resource.resource_id}, ${userId}, ${title})
    RETURNING *
  `;
});
```

### 2. Three-Layer Content Model

```
Layer 1: logical_block_slots (WHERE in document)
Layer 2: block_version_contents (WHO wrote WHAT WHEN)
Layer 3: content_blobs (actual text, SHA-256 keyed)
```

**Why:** Enables zero-cost forking. Structure is copied, content is reused.

**Implementation Pattern:**
```typescript
import { createHash } from 'crypto';

// 1. Hash content
const contentHash = createHash('sha256')
  .update(text, 'utf8')
  .digest('hex');

// 2. Insert blob (deduplicated)
await sql`
  INSERT INTO content_blobs (sha256, content_text, byte_size)
  VALUES (${contentHash}, ${text}, ${Buffer.byteLength(text, 'utf8')})
  ON CONFLICT (sha256) DO NOTHING
`;

// 3. Create version pointing to blob
await sql`
  INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
  VALUES (${slotId}, ${userId}, ${contentHash})
`;
```

### 3. Ternary Relationship (commit_manifests)

Connects THREE things: commit × slot × version

**Why:** Fast document assembly. One query, not diff-walking.

**Implementation Pattern:**
```sql
-- Get entire document from one commit
SELECT 
  lbs.lexorank_key,
  cb.content_text
FROM commit_manifests cm
JOIN logical_block_slots lbs ON cm.slot_id = lbs.slot_id
JOIN block_version_contents bvc ON cm.version_id = bvc.version_id
JOIN content_blobs cb ON bvc.content_blob_hash = cb.sha256
WHERE cm.commit_id = $1
ORDER BY lbs.lexorank_key;
```

### 4. LexoRank Ordering

**Problem:** Traditional integer ordering requires renumbering on insert  
**Solution:** Fractional keys between any two blocks

```typescript
function calculateMidpoint(prev: string, next: string): string {
  // prev = "1|100000", next = "1|200000"
  const [prefixP, numP] = prev.split('|');
  const [prefixN, numN] = next.split('|');
  
  const prevNum = parseInt(numP);
  const nextNum = parseInt(numN);
  const mid = Math.floor((prevNum + nextNum) / 2);
  
  return `${prefixP}|${mid.toString().padStart(6, '0')}`;
}
```

### 5. Main Branches

**Every note has exactly ONE main branch:**
- `is_main = TRUE`
- `issue_id = NULL`
- Created automatically on note creation

**Issue branches for collaboration:**
- `is_main = FALSE`
- `issue_id = <some issue>`
- Created when issue is opened

---

## 🛠️ Development Guidelines

### SQL Query Best Practices

**✅ DO:**
```typescript
// Parameterized queries
const [user] = await sql`
  SELECT * FROM users WHERE email = ${email}
`;

// Transactions for multi-table inserts
await sql.transaction(async (tx) => {
  const [resource] = await tx`INSERT INTO resources ...`;
  const [note] = await tx`INSERT INTO notes ...`;
});

// Check constraints before insert
const [existing] = await sql`
  SELECT 1 FROM issues
  WHERE target_slot_id = ${slotId}
  AND status IN ('OPEN', 'IN_PROGRESS')
`;
if (existing) throw new Error('Slot already has active issue');
```

**❌ DON'T:**
```typescript
// String concatenation (SQL injection!)
await sql(`SELECT * FROM users WHERE email = '${email}'`);

// Missing error handling
const user = await sql`...`;
// What if query fails?

// Forgetting ISA resource
await sql`INSERT INTO notebooks (notebook_id, ...) VALUES (...)`;
// Should create resource first!
```

### Server Action Pattern

**File structure:**
```
src/actions/
├── auth.ts           # signIn, signOut, getCurrentUser
├── notebooks.ts      # createNotebook, getNotebooks, updateNotebook
├── notes.ts          # createNote, getNotes, updateNote
├── blocks.ts         # updateBlock, insertBlock, deleteBlock
├── branches.ts       # createBranch, mergeBranch
├── commits.ts        # createCommit, getCommitHistory
├── issues.ts         # createIssue, assignContributor, resolveIssue
├── collaborators.ts  # addCollaborator, updateRole
└── editions.ts       # publishEdition, getEditions
```

**Standard template:**
```typescript
'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function actionName(params: ActionParams) {
  // 1. Authenticate
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // 2. Validate input
  if (!params.required) {
    throw new Error('Missing required field');
  }

  // 3. Check permissions
  const [permission] = await sql`
    SELECT role_type, capabilities
    FROM collaborator_roles
    WHERE user_id = ${user.user_id}
    AND resource_id = ${params.resourceId}
  `;
  
  if (!permission) throw new Error('Forbidden');
  if (permission.role_type === 'CONTRIBUTOR') {
    throw new Error('Insufficient permissions');
  }

  // 4. Execute operation (transaction if multi-table)
  await sql.transaction(async (tx) => {
    const [result] = await tx`
      INSERT INTO table_name (...)
      VALUES (...)
      RETURNING *
    `;
    
    // More operations...
    
    return result;
  });

  // 5. Revalidate affected pages
  revalidatePath('/dashboard');
  revalidatePath(`/notes/${params.noteId}`);

  return { success: true };
}
```

### Error Handling

```typescript
try {
  await actionName(params);
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    return { error: 'Resource already exists' };
  }
  if (error.code === '23503') {
    // Foreign key violation
    return { error: 'Referenced resource not found' };
  }
  
  console.error('Action failed:', error);
  return { error: 'Internal server error' };
}
```

---

## 🧪 Testing Your Code

### Manual Testing Flow

After implementing a Server Action:

1. **Browser test:**
   - Navigate to page
   - Execute action
   - Verify UI updates

2. **Database verification:**
   ```bash
   psql $DATABASE_URL -c "
     SELECT * FROM table_name 
     WHERE condition;
   "
   ```

3. **Check constraints:**
   ```bash
   # Try to violate a constraint
   # Should fail with proper error
   ```

4. **Transaction rollback test:**
   ```typescript
   // Cause an error mid-transaction
   // Verify nothing was inserted
   ```

### Example Test Cases

**Creating a note:**
```bash
# 1. Sign in as alice@bookworm.dev
# 2. Create notebook "Test Notebook"
# 3. Create note "Test Note" in that notebook

# 4. Verify in database:
psql $DATABASE_URL -c "
  SELECT 
    n.title,
    r.resource_type,
    b.branch_name,
    b.is_main,
    COUNT(c.commit_id) as commits
  FROM notes n
  JOIN resources r ON r.resource_id = n.note_id
  JOIN branches b ON b.note_id = n.note_id
  LEFT JOIN commits c ON c.branch_id = b.branch_id
  WHERE n.title = 'Test Note'
  GROUP BY n.note_id, r.resource_id, b.branch_id;
"

# Expected output:
# title="Test Note"
# resource_type="NOTE"
# branch_name="main"
# is_main=TRUE
# commits=1
```

**Content deduplication:**
```bash
# 1. Create note A with text "Hello World"
# 2. Create note B with same text "Hello World"

# 3. Check content_blobs:
psql $DATABASE_URL -c "
  SELECT sha256, content_text, COUNT(*) as references
  FROM content_blobs cb
  JOIN block_version_contents bvc ON bvc.content_blob_hash = cb.sha256
  WHERE cb.content_text = 'Hello World'
  GROUP BY cb.sha256, cb.content_text;
"

# Expected: Only ONE blob, but references=2
```

---

## 🚨 Common Mistakes to Avoid

### 1. Forgetting ISA Resource
```typescript
// ❌ WRONG
await sql`
  INSERT INTO notebooks (notebook_id, owner_id, title)
  VALUES (gen_random_uuid(), ${userId}, ${title})
`;

// ✅ CORRECT
await sql.transaction(async (tx) => {
  const [resource] = await tx`
    INSERT INTO resources (resource_type) VALUES ('NOTEBOOK') RETURNING resource_id
  `;
  await tx`
    INSERT INTO notebooks (notebook_id, owner_id, title)
    VALUES (${resource.resource_id}, ${userId}, ${title})
  `;
});
```

### 2. Creating Note Without Initial Commit
```typescript
// ❌ WRONG - Note with no history
await createResourceAndNote();

// ✅ CORRECT - Note + branch + slot + blob + version + commit + manifest
await sql.transaction(async (tx) => {
  const [resource] = await tx`INSERT INTO resources ...`;
  const [note] = await tx`INSERT INTO notes ...`;
  const [branch] = await tx`INSERT INTO branches ...`;
  const [slot] = await tx`INSERT INTO logical_block_slots ...`;
  
  const hash = createHash('sha256').update(initialContent).digest('hex');
  await tx`INSERT INTO content_blobs ... ON CONFLICT DO NOTHING`;
  const [version] = await tx`INSERT INTO block_version_contents ...`;
  const [commit] = await tx`INSERT INTO commits ...`;
  await tx`INSERT INTO commit_manifests ...`;
});
```

### 3. Not Checking Permissions
```typescript
// ❌ WRONG - Anyone can delete
export async function deleteNotebook(notebookId: string) {
  await sql`DELETE FROM notebooks WHERE notebook_id = ${notebookId}`;
}

// ✅ CORRECT - Only owners can delete
export async function deleteNotebook(notebookId: string) {
  const user = await getCurrentUser();
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE user_id = ${user.user_id}
    AND resource_id = ${notebookId}
    AND role_type = 'OWNER'
  `;
  
  if (!permission) throw new Error('Forbidden');
  
  await sql`UPDATE notebooks SET deleted_at = NOW() WHERE notebook_id = ${notebookId}`;
}
```

### 4. Forgetting Content Deduplication
```typescript
// ❌ WRONG - Always creates new blob
await sql`
  INSERT INTO content_blobs (sha256, content_text, byte_size)
  VALUES (${hash}, ${text}, ${size})
`;

// ✅ CORRECT - Reuses existing blob
await sql`
  INSERT INTO content_blobs (sha256, content_text, byte_size)
  VALUES (${hash}, ${text}, ${size})
  ON CONFLICT (sha256) DO NOTHING
`;
```

---

## 📋 Implementation Checklist

Use this checklist as you work through the roadmap:

### Phase 1: Database Connection & Auth
- [ ] Create `src/lib/db.ts` with Neon wrapper
- [ ] Implement `signIn(email, password)` Server Action
- [ ] Implement `signOut()` Server Action
- [ ] Implement `getCurrentUser()` Server Action
- [ ] Add session cookie management
- [ ] Protect dashboard route (middleware or redirect)
- [ ] Replace mock data in dashboard with real queries
- [ ] Test: Can log in as alice@bookworm.dev
- [ ] Test: Session persists across refresh
- [ ] Test: Can log out

### Phase 2: Notebooks & Notes CRUD
- [ ] Implement `createNotebook()` Server Action
- [ ] Implement `getNotebooks()` Server Action
- [ ] Implement `getNotes(notebookId)` Server Action
- [ ] Implement `createNote()` with full initialization
- [ ] Connect "New Notebook" modal to action
- [ ] Connect "New Note" modal to action
- [ ] Update sidebar to show real data
- [ ] Implement soft delete
- [ ] Test: Create notebook inserts resource + role
- [ ] Test: Create note inserts resource + note + branch + commit

### Phase 3-10: See detailed_architecture.md Section 5

---

## 🔗 Quick Reference

### Database Connection
```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
```

### Seed Users (for testing)
- `alice@bookworm.dev` (OWNER)
- `bob@bookworm.dev` (MAINTAINER)
- `charlie@bookworm.dev` (CONTRIBUTOR)

### Key SQL Patterns

**Get notebooks with permissions:**
```sql
SELECT nb.*, cr.role_type
FROM notebooks nb
JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id
WHERE cr.user_id = $1 AND nb.deleted_at IS NULL;
```

**Get note with blocks:**
```sql
SELECT 
  lbs.slot_id,
  lbs.lexorank_key,
  lbs.block_type,
  cb.content_text,
  bvc.created_at,
  u.username
FROM notes n
JOIN logical_block_slots lbs ON lbs.note_id = n.note_id
JOIN block_version_contents bvc ON bvc.slot_id = lbs.slot_id
JOIN content_blobs cb ON bvc.content_blob_hash = cb.sha256
JOIN users u ON bvc.author_id = u.user_id
WHERE n.note_id = $1
ORDER BY lbs.lexorank_key;
```

**Check permission:**
```sql
SELECT role_type, capabilities
FROM collaborator_roles
WHERE user_id = $1 AND resource_id = $2;
```

---

## 📞 When You Need Help

**Before asking:**
1. Re-read the relevant section in documentation
2. Check `schema.sql` for constraint definitions
3. Test your query directly in psql
4. Check Neon console for error logs

**When reporting issues:**
- Include the full error message
- Show the SQL query that failed
- Explain what you expected vs what happened
- Include relevant parts of the schema

**Good question:**
> I'm implementing createNote and getting error "violates foreign key constraint". Here's my code: [code]. I expected it to create a resource first, then a note. The schema says note_id must reference resources.resource_id. What am I missing?

**Bad question:**
> createNote doesn't work. Help?

---

## 🎯 Your Success Criteria

A **well-implemented** BookWorm project has:

✅ All 15 tables connected and used  
✅ Raw SQL queries demonstrating:
- Complex joins (4+ tables)
- Subqueries
- Aggregates with GROUP BY
- Window functions (optional)
- Recursive CTEs (commit history)
- Transactions with proper rollback

✅ Proper constraints enforced:
- ISA hierarchy with triggers
- Block locking with partial unique index
- Ternary relationship with composite FK

✅ Real features working:
- Create/read notebooks and notes
- Edit content with versioning
- Branch and merge
- Content deduplication (same text = one blob)
- Permission checks (can't edit without role)

✅ Documentation:
- Updated `detailed_architecture.md` with progress
- Clear commit messages
- Inline comments explaining complex queries

---

**Remember:** This is a database course project. Show off your SQL skills, not your framework knowledge. The professor wants to see complex queries, proper normalization, and thoughtful schema design in action.

Good luck! 🚀

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**For:** AI assistants working on BookWorm implementation
