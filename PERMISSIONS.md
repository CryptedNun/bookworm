# BookWorm Permission System

## Overview

BookWorm implements a comprehensive Role-Based Access Control (RBAC) system for collaborative note editing, following Git-like workflow principles.

## Role Hierarchy

```
OWNER > MAINTAINER > CONTRIBUTOR
```

### OWNER
- **Full control** over the resource (notebook or note)
- Can perform ALL actions
- Can grant/revoke any role to other users
- Can delete the resource
- **Automatically assigned** when creating a resource

### MAINTAINER
- **Collaborative management** permissions
- Can edit main branch directly
- Can merge branches
- Can create/manage issues
- Can add contributors
- **Configurable capabilities** via JSON field

### CONTRIBUTOR
- **Issue-based contributions** only
- **CANNOT edit main branch directly**
- **MUST create issues** to propose changes
- Can be assigned to issues
- Works on issue-specific branches
- Changes reviewed and merged by OWNER/MAINTAINER

---

## Permission Matrix

| Action | OWNER | MAINTAINER | CONTRIBUTOR |
|--------|-------|------------|-------------|
| **Notebooks** |
| Create notebook | ✅ | ❌ | ❌ |
| Update notebook metadata | ✅ | ✅ | ❌ |
| Delete notebook | ✅ | ❌ | ❌ |
| Add note to notebook | ✅ | ✅ | ❌ |
| Reorder notes | ✅ | ✅ | ❌ |
| Delete note | ✅ | ❌ | ❌ |
| **Notes** |
| View note | ✅ | ✅ | ✅ |
| Edit main branch directly | ✅ | ✅ | ❌ |
| Create issue | ✅ | ✅ | ✅ |
| **Issues & Branches** |
| Assign contributor to issue | ✅ | ✅ | ❌ |
| Close issue | ✅ | ✅ | Creator only |
| Merge branch to main | ✅ | ✅ | ❌ |
| Delete branch | ✅ | ✅ | ❌ |
| Edit issue branch | ✅ | ✅ | If assigned |
| **Collaboration** |
| Add collaborator | ✅ | ✅* | ❌ |
| Remove collaborator | ✅ | ❌ | ❌ |
| Change user role | ✅ | ❌ | ❌ |

\* Requires `can_add_contributor` capability

---

## Workflow Examples

### Scenario 1: Owner/Maintainer Direct Edit

```
1. Alice (OWNER) opens note in editor
2. Alice edits blocks on main branch
3. Changes committed directly to main
4. Note updated immediately
```

**Implementation:**
```typescript
// Server Action: updateBlock
const [permission] = await sql`
  SELECT role_type FROM collaborator_roles
  WHERE resource_id = ${noteId}
  AND user_id = ${userId}
  AND role_type IN ('OWNER', 'MAINTAINER')
`;

if (!permission) {
  return { success: false, error: 'Insufficient permissions' };
}
```

---

### Scenario 2: Contributor Issue-Based Edit

```
1. Bob (CONTRIBUTOR) views note
2. Bob clicks "Suggest Edit" button
3. System creates Issue targeting specific block
4. System automatically creates issue branch
5. Bob assigned to issue as contributor
6. Bob edits on issue branch
7. Bob commits changes
8. Alice (MAINTAINER) reviews
9. Alice merges to main OR requests changes
```

**Implementation:**
```typescript
// Step 3-5: createIssue
const issue = await createIssue({
  noteId,
  slotId, // Target block
  title: "Fix typo in Section 3",
  description: "..."
});

// Automatically creates:
// - Issue record with status='OPEN'
// - Issue branch (non-main)
// - Assigns creator as contributor

// Step 6: Edit permission check
const canEdit = await canEditOnBranch(noteId, branchId, userId);
// Returns { allowed: true } only if user assigned to issue
```

---

## Database Constraints Enforcing Permissions

### 1. ISA Hierarchy (Resources)

```sql
-- Every notebook/note IS A resource
CREATE TABLE resources (
  resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('NOTEBOOK', 'NOTE'))
);

CREATE TABLE notebooks (
  notebook_id UUID PRIMARY KEY 
    REFERENCES resources(resource_id) ON DELETE CASCADE
);

CREATE TABLE notes (
  note_id UUID PRIMARY KEY 
    REFERENCES resources(resource_id) ON DELETE CASCADE
);

-- Permissions reference resources
CREATE TABLE collaborator_roles (
  resource_id UUID REFERENCES resources(resource_id),
  -- Works for both notebooks AND notes!
);
```

**Why:** Unified permission model for all resource types.

---

### 2. Block Locking via Unique Index

```sql
-- Only ONE active issue per block
CREATE UNIQUE INDEX idx_active_issue_per_slot 
ON issues(target_slot_id) 
WHERE status IN ('OPEN', 'IN_PROGRESS');
```

**Why:** Prevents concurrent editing conflicts. Once a block is locked by an issue, no other issue can target it until resolved.

**Example:**
```sql
-- Issue #1 targets Slot #42 (status='OPEN')
INSERT INTO issues (target_slot_id, ...) VALUES ('slot-42-uuid', ...);
-- ✅ Success

-- Issue #2 tries to target Slot #42
INSERT INTO issues (target_slot_id, ...) VALUES ('slot-42-uuid', ...);
-- ❌ ERROR: Unique constraint violation
```

---

### 3. Non-Main Branches MUST Have Issue

```sql
CREATE TABLE branches (
  branch_id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(note_id),
  issue_id UUID REFERENCES issues(issue_id),
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Constraint: Non-main branches require issue_id
  CONSTRAINT branch_issue_required
    CHECK (is_main = TRUE OR issue_id IS NOT NULL)
);
```

**Why:** Enforces that contributors work through issues, not direct branching.

**Example:**
```sql
-- Main branch (no issue required)
INSERT INTO branches (note_id, is_main, issue_id)
VALUES ('note-123', TRUE, NULL);
-- ✅ Success

-- Feature branch WITHOUT issue
INSERT INTO branches (note_id, is_main, issue_id)
VALUES ('note-123', FALSE, NULL);
-- ❌ ERROR: Check constraint violation

-- Feature branch WITH issue
INSERT INTO branches (note_id, is_main, issue_id)
VALUES ('note-123', FALSE, 'issue-456');
-- ✅ Success
```

---

## Maintainer Capabilities

MAINTAINER role has fine-grained control via JSON capabilities:

```json
{
  "can_create_issue": true,
  "can_delete_branch": false,
  "can_merge_branch": true,
  "can_add_contributor": true
}
```

### Setting Capabilities

```sql
UPDATE collaborator_roles
SET capabilities = '{
  "can_create_issue": true,
  "can_delete_branch": false,
  "can_merge_branch": true,
  "can_add_contributor": false
}'::jsonb
WHERE role_id = 'role-uuid';
```

### Checking Capabilities (Server Action)

```typescript
import { hasCapability } from '@/lib/permissions';

const canMerge = await hasCapability(noteId, userId, 'can_merge_branch');
if (!canMerge) {
  return { success: false, error: 'No merge capability' };
}
```

---

## Server Action Permission Patterns

### Pattern 1: Simple Role Check

```typescript
export async function updateNotebook(notebookId: string, updates: any, userId: string) {
  // Check permission
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE resource_id = ${notebookId}
      AND user_id = ${userId}
      AND role_type IN ('OWNER', 'MAINTAINER')
  `;

  if (!permission) {
    return { success: false, error: 'Insufficient permissions' };
  }

  // Perform action
  await sql`UPDATE notebooks SET title = ${updates.title} WHERE notebook_id = ${notebookId}`;
  return { success: true };
}
```

---

### Pattern 2: Owner-Only Check

```typescript
export async function deleteNotebook(notebookId: string, userId: string) {
  // Verify OWNER role
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE resource_id = ${notebookId}
      AND user_id = ${userId}
      AND role_type = 'OWNER'
  `;

  if (!permission) {
    return { success: false, error: 'Only owners can delete notebooks' };
  }

  await sql`DELETE FROM resources WHERE resource_id = ${notebookId}`;
  return { success: true };
}
```

---

### Pattern 3: Capability Check

```typescript
export async function mergeBranch(branchId: string, userId: string) {
  const [branch] = await sql`
    SELECT note_id FROM branches WHERE branch_id = ${branchId}
  `;

  // Check if user has merge capability
  const canMerge = await hasCapability(branch.note_id, userId, 'can_merge_branch');
  
  if (!canMerge) {
    return { 
      success: false, 
      error: 'Insufficient permissions. Only users with merge capability can merge branches.' 
    };
  }

  // Perform merge...
}
```

---

### Pattern 4: Branch-Specific Permission

```typescript
export async function updateBlockOnBranch(
  noteId: string,
  branchId: string,
  slotId: string,
  content: string,
  userId: string
) {
  // Check if user can edit on this specific branch
  const editCheck = await canEditOnBranch(noteId, branchId, userId);
  
  if (!editCheck.allowed) {
    return { success: false, error: editCheck.reason };
  }

  // Perform update...
}
```

---

## Permission Audit Checklist

✅ **All Server Actions have been audited for:**

1. ✅ Authentication check (`getCurrentUser()`)
2. ✅ Resource ownership/access check
3. ✅ Role-based permission check
4. ✅ Capability check (for MAINTAINER-specific actions)
5. ✅ Branch-level permission (for editing)
6. ✅ Issue assignment check (for contributors)

**Audited Files:**
- `src/actions/auth.ts` - Authentication layer
- `src/actions/notebooks.ts` - Notebook CRUD permissions
- `src/actions/notes.ts` - Note CRUD permissions
- `src/actions/issues.ts` - Issue creation and management
- `src/actions/branches.ts` - Branch and merge permissions
- `src/actions/blocks.ts` - Block editing permissions

---

## Security Best Practices

### 1. Always Check Permissions Server-Side

❌ **BAD** - Client-side only:
```typescript
// client-component.tsx
if (user.role === 'OWNER') {
  await deleteNote(noteId); // No server check!
}
```

✅ **GOOD** - Server-side enforcement:
```typescript
// Server Action
export async function deleteNote(noteId: string, userId: string) {
  // Server verifies permission
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE resource_id = ${noteId} AND user_id = ${userId} AND role_type = 'OWNER'
  `;
  
  if (!permission) throw new Error('Unauthorized');
  // ...
}
```

---

### 2. Use Database Constraints

Let the database enforce invariants:
- ✅ Foreign keys prevent orphaned records
- ✅ Unique indexes prevent duplicate issues per slot
- ✅ Check constraints enforce business rules
- ✅ Triggers maintain referential integrity

---

### 3. Principle of Least Privilege

- Grant minimum necessary permissions
- CONTRIBUTOR by default
- MAINTAINER for trusted collaborators
- OWNER only for resource creators

---

## Testing Permissions

### Manual Testing Checklist

- [ ] Create notebook as User A (OWNER)
- [ ] Invite User B as CONTRIBUTOR
- [ ] User B tries to edit main → Should fail
- [ ] User B creates issue → Should succeed
- [ ] User B edits on issue branch → Should succeed
- [ ] User A merges branch → Should succeed
- [ ] User B tries to delete note → Should fail
- [ ] User A upgrades B to MAINTAINER
- [ ] User B edits main → Should succeed

---

## Troubleshooting

### "Insufficient permissions" Error

1. **Check user has collaborator role:**
   ```sql
   SELECT * FROM collaborator_roles
   WHERE resource_id = '<note-id>' AND user_id = '<user-id>';
   ```

2. **Verify role type is sufficient:**
   - CONTRIBUTOR? Must use issues for main branch edits
   - MAINTAINER? Check capabilities JSON

3. **For branch edits, check issue assignment:**
   ```sql
   SELECT * FROM issue_contributors
   WHERE issue_id = '<issue-id>' AND contributor_id = '<user-id>';
   ```

---

### Block Lock Error

```
"This block is already locked by issue: ..."
```

**Cause:** Another active issue targets the same block.

**Solution:** 
1. Complete/close the existing issue, OR
2. Target a different block

**Check:**
```sql
SELECT * FROM issues
WHERE target_slot_id = '<slot-id>'
AND status IN ('OPEN', 'IN_PROGRESS');
```

---

## Reference

- **Architecture:** `bookworm_architecture.md` Section 4.2 (ISA Hierarchy)
- **Schema:** `schema.sql` Lines 52-150 (Collaborator roles)
- **Utility Functions:** `src/lib/permissions.ts`
- **Enforcement:** All files in `src/actions/`
