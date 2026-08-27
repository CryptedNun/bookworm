# BookWorm Testing Guide

## Overview

This guide provides comprehensive end-to-end testing procedures for the three critical fixes implemented:

1. **Note Creation** - Fixed UUID error, added notebook selector
2. **Notebook Management** - Added note creation, reordering, and deletion  
3. **Branching Visualization** - Complete tree view of commits and branches

---

## Prerequisites

### 1. Database Setup

Ensure your database is seeded with test data:

```bash
# Connect to your Neon database
psql $DATABASE_URL -f schema.sql
psql $DATABASE_URL -f seed_data.sql
```

### 2. Environment

```bash
# Verify .env.local exists with DATABASE_URL
cat .env.local | grep DATABASE_URL

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Test Users

The seed data should include:
- `alice@bookworm.dev` (OWNER)
- `bob@bookworm.dev` (CONTRIBUTOR)  
- `charlie@bookworm.dev` (MAINTAINER)

---

## Test Suite 1: Note Creation

### Test 1.1: Create Note from Dashboard

**Steps:**
1. Navigate to `http://localhost:3000`
2. Sign in as `alice@bookworm.dev`
3. Click the **"+"** button in top nav OR click **"New Note"** in sidebar
4. Modal should open with tabs: Note, Notebook, Issue, Branch, Fork

**Expected Results:**
- ✅ Modal opens without errors
- ✅ "Note" tab is available
- ✅ Form has "Title" and "Select Notebook" fields

---

### Test 1.2: Notebook Selector Validation

**Steps:**
1. Open Create Note modal
2. Try to submit form WITHOUT selecting notebook
3. Browser should show validation error

**Expected Results:**
- ✅ Form validation prevents submission
- ✅ "Select Notebook" field shows "required" indicator
- ✅ Error message: "Please select a notebook"

---

### Test 1.3: Create Note with Valid Data

**Steps:**
1. Open Create Note modal
2. Enter title: "Test Note - Algorithms"
3. Select notebook: "CS 101 Study Notes"
4. Enter description (optional): "Testing note creation"
5. Click "Create Resource"

**Expected Results:**
- ✅ Success toast appears: "Note 'Test Note - Algorithms' created successfully!"
- ✅ Modal closes
- ✅ Dashboard refreshes with new note visible
- ✅ Note appears in selected notebook

**Database Verification:**
```sql
SELECT n.title, n.notebook_id, b.branch_name, b.is_main
FROM notes n
INNER JOIN branches b ON b.note_id = n.note_id
WHERE n.title = 'Test Note - Algorithms';

-- Should show:
-- title: "Test Note - Algorithms"
-- branch_name: "main"
-- is_main: TRUE
```

---

### Test 1.4: UUID Error Fixed

**Validation:**
Previous error was related to UUID generation in the transaction chain.

**Steps:**
1. Create 5 notes in rapid succession
2. No errors should occur

**Expected Results:**
- ✅ All 5 notes created successfully
- ✅ Each has unique UUID for note_id
- ✅ Each has main branch with unique branch_id
- ✅ Each has initial commit

---

## Test Suite 2: Notebook Management

### Test 2.1: Navigate to Notebook Management

**Steps:**
1. From dashboard, click on any notebook title in sidebar
2. Should navigate to `/dashboard/notebooks/[id]/manage`

**Expected Results:**
- ✅ URL shows `/manage` path
- ✅ Page displays notebook title and description
- ✅ List of notes shown with drag handles
- ✅ "New Note" button visible

---

### Test 2.2: Create Note from Notebook

**Steps:**
1. On notebook management page, click **"New Note"** button
2. Modal opens (different from dashboard modal - inline, notebook pre-selected)
3. Enter title: "Quick Note from Notebook"
4. Click "Create Note"

**Expected Results:**
- ✅ Modal specific to this notebook
- ✅ Notebook pre-selected (not shown in form)
- ✅ Note created in correct notebook
- ✅ Page refreshes showing new note at bottom of list

---

### Test 2.3: Drag and Drop Note Reordering

**Steps:**
1. Notebook must have at least 3 notes
2. Note current order (e.g., Note A, Note B, Note C)
3. Click and hold drag handle (⋮⋮ icon) on Note C
4. Drag Note C above Note A
5. Release mouse

**Expected Results:**
- ✅ Note C visually moves during drag
- ✅ Other notes shift to make space
- ✅ On release, new order persists: Note C, Note A, Note B
- ✅ Success toast: "Note order updated successfully"
- ✅ Refresh page → order remains

**Database Verification:**
```sql
SELECT title, display_order
FROM notes
WHERE notebook_id = '<notebook-id>'
ORDER BY display_order ASC;

-- display_order should reflect new order
```

---

### Test 2.4: Delete Note

**Steps:**
1. Find a test note in the list
2. Hover over note row → action buttons appear
3. Click trash icon (🗑️)
4. Confirm deletion dialog

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Note removed from list immediately
- ✅ Success toast appears
- ✅ Note visibility changed to PRIVATE (soft delete)

**Database Verification:**
```sql
SELECT note_id, title, visibility
FROM notes
WHERE title = '<deleted-note-title>';

-- visibility should be 'PRIVATE'
```

---

### Test 2.5: Permission Check (CONTRIBUTOR)

**Steps:**
1. Sign out
2. Sign in as `bob@bookworm.dev` (CONTRIBUTOR)
3. Navigate to a notebook where Bob is CONTRIBUTOR
4. Try to create note

**Expected Results:**
- ✅ "New Note" button NOT visible (Bob doesn't have permission)
- ✅ Drag handles NOT visible on notes
- ✅ Delete buttons NOT visible

---

## Test Suite 3: Branching Visualization

### Test 3.1: Access Tree View

**Steps:**
1. Navigate to notebook management page
2. Hover over any note
3. Click the branch icon (🌿) OR
4. Navigate to `/dashboard/notebooks/[notebookId]/notes/[noteId]/tree`

**Expected Results:**
- ✅ Tree visualization page loads
- ✅ Shows "Commit History Tree" header
- ✅ Displays commit graph similar to `git log --graph`

---

### Test 3.2: Verify Commit Graph Structure

**Setup:**
- Note should have at least main branch with 3+ commits
- Ideally, also have an issue branch with 1-2 commits

**Expected Results:**
- ✅ **Main branch commits** shown in emerald green
- ✅ **Issue branch commits** shown in different color (blue/purple/amber)
- ✅ Commits connected with lines showing parent-child relationships
- ✅ Merge commits shown with GitMerge icon
- ✅ Regular commits shown with GitCommit icon

**Visual Structure:**
```
● [main] Latest commit message           (7d4a3b2) 2 hours ago
│
● [main] Second commit                    (9f1c8e4) 5 hours ago
│ 
├─● [issue-42] Fix typo in section 3    (2a8d1f3) 3 hours ago
│ │
│ ● [issue-42] Add diagram               (5b3c9e7) 4 hours ago
│/
● [main] Initial commit                   (1a2b3c4) 1 day ago
```

---

### Test 3.3: Filter Branches

**Steps:**
1. On tree view page, locate filter checkboxes
2. Uncheck "Show all branches"
3. Only main branch commits should remain
4. Re-check "Show all branches"
5. All commits reappear

**Expected Results:**
- ✅ Filters work instantly (no page reload)
- ✅ Commit count updates dynamically
- ✅ Tree structure recalculates properly

---

### Test 3.4: Click Commit for Details

**Steps:**
1. Click on any commit in the tree
2. Commit row should highlight
3. View button appears or becomes active

**Expected Results:**
- ✅ Selected commit highlighted with ring effect
- ✅ Background changes to show selection
- ✅ Can view commit details (implementation pending)

---

### Test 3.5: Navigate from Tree to Branches

**Steps:**
1. On tree view page, click "Back" arrow in top-left
2. Should navigate to `/notes/[id]/branches` page

**Expected Results:**
- ✅ Branches list page loads
- ✅ Shows all branches with status
- ✅ "Tree View" button available to return

---

### Test 3.6: Navigate from Branches to Tree

**Steps:**
1. On branches page, click "Tree View" button in top-right
2. Should navigate to tree visualization

**Expected Results:**
- ✅ Seamless navigation
- ✅ Tree view shows all branches from branches page
- ✅ Data is consistent

---

## Integration Tests

### Integration Test 1: Full Workflow - Owner

**Scenario:** Alice creates notebook, adds notes, reorders, views tree

**Steps:**
1. Sign in as Alice
2. Create notebook: "Integration Test Notebook"
3. Create 3 notes: "Note A", "Note B", "Note C"
4. Navigate to notebook management
5. Reorder: Move "Note C" to position 1
6. Click tree icon on "Note A"
7. View commit history

**Expected Results:**
- ✅ All operations succeed
- ✅ No errors in console
- ✅ Data persists across page refreshes
- ✅ Tree shows initial commits for all notes

---

### Integration Test 2: Collaboration Workflow

**Scenario:** Alice (Owner) and Bob (Contributor) collaborate

**Steps:**
1. Alice creates note "Collaboration Test"
2. Alice invites Bob as CONTRIBUTOR
3. Bob creates issue targeting a block
4. Bob edits on issue branch
5. Alice merges Bob's branch
6. View tree - should show merge

**Expected Results:**
- ✅ Bob can create issue but not edit main
- ✅ Bob's commits appear on issue branch
- ✅ After merge, Bob's commits visible in main timeline
- ✅ Tree shows branch and merge clearly

---

## Performance Tests

### Performance Test 1: Large Notebook

**Setup:**
- Create notebook with 50+ notes

**Expected Results:**
- ✅ Dashboard loads in < 2 seconds
- ✅ Notebook management page loads in < 2 seconds
- ✅ Drag and drop remains smooth
- ✅ No UI freezing

---

### Performance Test 2: Complex Commit History

**Setup:**
- Note with 100+ commits across 10+ branches

**Expected Results:**
- ✅ Tree view renders in < 3 seconds
- ✅ No layout thrashing
- ✅ Scrolling is smooth
- ✅ Filtering responds instantly

---

## Error Handling Tests

### Error Test 1: Network Failure During Note Creation

**Steps:**
1. Open DevTools → Network tab
2. Start creating note
3. Disable network ("Offline" mode) before form submission
4. Click "Create Resource"

**Expected Results:**
- ✅ Error message displayed: "Failed to create note"
- ✅ Modal remains open
- ✅ Form data not lost
- ✅ User can retry after re-enabling network

---

### Error Test 2: Concurrent Note Reordering

**Steps:**
1. Open notebook management in two browser tabs
2. Drag note to new position in Tab 1
3. Simultaneously drag different note in Tab 2

**Expected Results:**
- ✅ Both operations complete
- ✅ Final order is deterministic
- ✅ No data loss
- ✅ Refresh shows consistent state

---

### Error Test 3: Invalid UUID

**Validation:**
- Try accessing non-existent note: `/notes/invalid-uuid/tree`

**Expected Results:**
- ✅ Redirect to dashboard or 404 page
- ✅ No crash or white screen
- ✅ User-friendly error message

---

## Accessibility Tests

### A11y Test 1: Keyboard Navigation

**Steps:**
1. Navigate entire create note flow using only keyboard
2. Tab through all form fields
3. Use Enter to submit

**Expected Results:**
- ✅ All interactive elements reachable via Tab
- ✅ Focus indicators visible
- ✅ Form submits with Enter key
- ✅ Modal closes with Escape key

---

### A11y Test 2: Screen Reader

**Steps:**
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate notebook management page
3. Activate drag and drop

**Expected Results:**
- ✅ All text announced correctly
- ✅ Drag handles have aria-label
- ✅ Buttons have descriptive labels
- ✅ Success/error messages announced

---

## Browser Compatibility

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

All core features should work identically.

---

## Known Issues / Limitations

1. **Tree View Layout** - Very complex branch structures (20+ concurrent branches) may become difficult to read
2. **Drag and Drop** - Mobile touch events not yet optimized
3. **Real-time Updates** - Changes by other users require page refresh

---

## Regression Testing

Before any deployment, run:

1. ✅ All Test Suite 1 tests (Note Creation)
2. ✅ All Test Suite 2 tests (Notebook Management)
3. ✅ All Test Suite 3 tests (Branching Visualization)
4. ✅ Integration Test 1 and 2
5. ✅ Error Handling Tests

---

## Automated Testing (Future)

Consider implementing:
- **Unit tests**: Server Actions with mocked database
- **Integration tests**: Full workflows with test database
- **E2E tests**: Playwright/Cypress for UI automation

---

## Test Sign-Off

**Tester:** ___________________  
**Date:** ___________________  
**Build Version:** ___________________

**Test Results:**
- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Performance acceptable
- [ ] Ready for production

**Notes:**
___________________________________
___________________________________
___________________________________
