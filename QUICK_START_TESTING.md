# BookWorm - Quick Start Testing Guide 🚀

**Status:** ✅ Phases 1-6 Complete  
**What to Test:** Issue-based branching with block locking  

---

## 🏃 Quick Start (2 minutes)

```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm run dev
```

Navigate to: `http://localhost:3000`

---

## 🧪 5 Critical Tests (15 minutes total)

### Test 1: Create Issue & Edit (5 min) ⭐

**Goal:** Create issue, auto-create branch, edit on branch

1. Sign in (alice@bookworm.dev / password123)
2. Open "Python Basics" notebook
3. Click "Sample Note" → Click "Issues" button (top right)
4. Click "+ New Issue"
5. Title: "Update introduction paragraph"
6. Select Block #1 (first block)
7. Click "Create Issue & Start Editing"

**✅ Success:**
- ✔ Redirects to editor with branch parameter
- ✔ Branch switcher shows "issue-xxx/update-introduction-paragraph"
- ✔ Can edit block #1
- ✔ Saves create commits on issue branch

**Try:**
- Edit block #1, change text
- Save (Ctrl+S)
- Go to `/branches` and see your issue branch

---

### Test 2: Block Locking (3 min) ⭐⭐

**Goal:** Verify block locking prevents duplicate issues

1. Keep issue from Test 1 open (don't merge yet)
2. Open new browser tab (or incognito)
3. Sign in again → Same note → Click "Issues"
4. Click "+ New Issue"
5. Try to select Block #1 again

**✅ Success:**
- ✔ Block #1 shows "🔒 LOCKED" badge (red)
- ✔ Button is disabled (can't click)
- ✔ Other blocks are still selectable
- ✔ Tooltip or visual indication it's locked

**Try:**
- Select Block #2 instead
- Create second issue successfully
- Verify 2 active issues, 2 different blocks

---

### Test 3: Merge Issue (4 min) ⭐⭐⭐

**Goal:** Merge issue branch back to main, unlock block

1. From issue branch (Test 1), edit block and save
2. Go to `/branches` page
3. Find your issue branch in "Active Branches"
4. Click "Merge" icon (GitMerge icon)
5. Optional: Add merge message
6. Click "Merge"

**✅ Success:**
- ✔ Success message appears
- ✔ Branch moves to "Merged Branches" section
- ✔ Main branch updated with your changes
- ✔ Block #1 now unlocked (test by creating new issue)

**Try:**
- Go back to `/issues`
- See issue status changed to "MERGED"
- Try creating new issue on Block #1 (should work now!)

---

### Test 4: Permission Enforcement (2 min) ⭐⭐

**Goal:** Verify CONTRIBUTOR can't edit main, needs issues

**Setup:** This requires a CONTRIBUTOR role. Let me check if we have one in seed data...

**If you have CONTRIBUTOR user:**
1. Sign in as CONTRIBUTOR
2. Try to go to `/edit` (without branch parameter)
3. System should redirect to `/issues`

**If OWNER/MAINTAINER:**
1. Sign in as alice (OWNER)
2. Go to `/edit` (no branch param)
3. Can edit main branch directly
4. No redirect

**✅ Success:**
- ✔ OWNER/MAINTAINER can edit main
- ✔ CONTRIBUTOR redirected to issues
- ✔ Can only edit assigned issue branches

---

### Test 5: Multiple Parallel Issues (3 min) ⭐⭐⭐

**Goal:** Show zero-conflict collaboration

1. Create issue on Block #1 → Edit it
2. Create issue on Block #2 → Edit it  
3. Create issue on Block #3 → Edit it
4. Go to `/branches`

**✅ Success:**
- ✔ See 3 active issue branches
- ✔ All show "IN_PROGRESS" status
- ✔ Can work on all 3 simultaneously
- ✔ ZERO conflicts possible!
- ✔ Each branch edits different block

**Try:**
- Edit block on branch 1, save
- Edit block on branch 2, save
- Merge all 3 branches one by one
- All merge cleanly with no conflicts!

---

## 🎯 What Success Looks Like

After these 5 tests, you should see:

✅ **Issues work** - Can create issues targeting blocks  
✅ **Branches auto-create** - Each issue gets a branch  
✅ **Block locking works** - Can't create duplicate issues  
✅ **Merging works** - Changes merge back to main  
✅ **Unlocking works** - Merged issues free up blocks  
✅ **Parallel edits** - Multiple issues work simultaneously  
✅ **Zero conflicts** - Different blocks = no conflicts!  

---

## 🐛 If Something Breaks

### Issue: "Branch already exists"
- Check database for duplicate branches
- May need to close/merge old issue first

### Issue: "Block is locked"
- This is correct! Working as designed
- Check `/issues` to see which issue has it
- Close/merge that issue first

### Issue: "Permission denied"
- Check your role (OWNER/MAINTAINER/CONTRIBUTOR)
- CONTRIBUTORS can't edit main directly
- Must create issue first

### Issue: "Can't create issue"
- Check if block already has active issue
- Check browser console (F12) for errors
- Verify database connection

---

## 📊 Database Verification (Optional)

**After creating issue, check database:**

```sql
-- See all issues
SELECT issue_id, title, status, target_slot_id 
FROM issues 
WHERE note_id = 'your-note-id';

-- See all branches
SELECT branch_id, branch_name, issue_id, attempted_by, is_merged
FROM branches
WHERE note_id = 'your-note-id';

-- Verify block locking
SELECT target_slot_id, COUNT(*) as issue_count
FROM issues
WHERE status IN ('OPEN', 'IN_PROGRESS')
GROUP BY target_slot_id
HAVING COUNT(*) > 1;
-- Should return ZERO rows (no duplicates!)
```

---

## 🎉 Key Features to Notice

### 1. Block Locking UI
- Red "🔒 LOCKED" badge on occupied blocks
- Disabled state (can't click)
- Clear visual hierarchy

### 2. Auto-Navigation
- Create issue → Auto-redirects to editor
- Branch parameter added to URL
- Branch switcher shows current branch

### 3. Status Tracking
- OPEN (blue) - Just created
- IN_PROGRESS (yellow) - Someone working on it
- MERGED (green) - Changes merged to main
- CLOSED (gray) - Closed without merging

### 4. Branch Naming
- Format: `issue-{id}/{title}`
- Example: `issue-abc12345/update-introduction-paragraph`
- Auto-generated, human-readable

---

## 🚀 Advanced Testing (Optional)

### Test: Branch Comparison
1. Create issue and edit blocks
2. Go to `/branches`
3. Click "Compare" (eye icon) on issue branch
4. See diff with stats: Added/Modified/Deleted

### Test: Branch Switching
1. Create issue branch
2. In editor, click branch dropdown
3. Switch between main and issue branch
4. See different content per branch

### Test: Commit History
1. On issue branch, make multiple edits
2. Save after each edit (creates commits)
3. Go to `/branches`
4. Expand commit history (click GitCommit icon)
5. See all your commits listed

---

## 📈 Expected Performance

- **Issue creation:** < 200ms
- **Branch auto-creation:** < 300ms  
- **Block lock check:** < 50ms
- **Merge operation:** < 500ms
- **UI updates:** Instant (optimistic)

---

## 🎓 Understanding the System

### Why Block Locking?

**Traditional Git Problem:**
```
Alice edits line 5: "The quick brown fox"
Bob edits line 5:   "The speedy red fox"
→ MERGE CONFLICT! Manual resolution required
```

**BookWorm Solution:**
```
Alice creates issue on Block #5
→ Block #5 LOCKED
→ Bob CANNOT create issue on Block #5
→ Alice finishes → Merges → Block #5 UNLOCKED
→ Now Bob can work on Block #5
→ IMPOSSIBLE to have conflicts!
```

### Why Multiple Branches Per Issue?

```
Issue: "Improve introduction"
  ├─ Alice's attempt: Adds examples
  ├─ Bob's attempt: Makes it concise
  └─ Charlie's attempt: Adds diagrams

Maintainer reviews all 3, picks best one!
This is powerful for team collaboration.
```

---

## 📞 Reporting Issues

If you find bugs, note:
1. **What you did** (exact steps)
2. **What you expected** (desired result)
3. **What happened** (actual result)
4. **Browser console** (F12 → Console tab, copy errors)
5. **URL** (what page you were on)

---

## ✅ Completion Checklist

- [ ] Test 1: Create issue & edit
- [ ] Test 2: Block locking works
- [ ] Test 3: Merge issue successfully
- [ ] Test 4: Permissions enforced
- [ ] Test 5: Multiple parallel issues

**All 5 passing?** 🎉 **System is working!**

---

**Time Required:** 15 minutes  
**Next:** Phase 7 - Advanced collaboration features  
**Status:** Ready for testing  

🚀 **Let's test the zero-conflict collaboration system!**
