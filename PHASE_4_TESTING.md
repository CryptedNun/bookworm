# Phase 4: Drag-to-Reorder Testing Guide

**Status:** ✅ Implementation Complete - Ready for Testing  
**Date:** 2026-08-26

---

## 🎉 What's Been Implemented

### 1. ✅ Drag-and-Drop with dnd-kit
- **Full drag-and-drop reordering** of blocks
- **Visual feedback** during drag (opacity, border glow)
- **Drag overlay** showing what's being dragged
- **Touch support** for mobile devices
- **Keyboard navigation** (arrow keys + Space/Enter)

### 2. ✅ Keyboard Shortcuts
- **Ctrl+S / Cmd+S** - Save current block
- **Esc** - Cancel editing
- **Ctrl+Enter hint** - Shown on insert buttons

### 3. ✅ Optimistic Updates
- **Instant UI feedback** - Changes appear immediately
- **Server sync** - Background save to database
- **Automatic revert** - Rolls back on error

### 4. ✅ Enhanced Loading States
- **Spinner animations** - When saving/loading
- **Success indicators** - Green checkmark + "Saved" label (2s)
- **Error banner** - Red banner with dismiss button
- **Disabled states** - Buttons disabled during operations

### 5. ✅ Visual Polish
- **Block type icons** - Paragraph, Heading, Code, Quote
- **Drag handles** - Appear on hover
- **Better spacing** - Clean, modern layout
- **Smooth transitions** - All state changes animated

---

## 🚨 HUMAN ACTION REQUIRED - Testing

### Prerequisites

1. **Start dev server:**
```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm run dev
```

2. **Open browser:** `http://localhost:3000`

3. **Sign in** (mock auth or real user)

4. **Navigate to a note with blocks**

---

## 📋 Test Cases

### Test 1: Basic Drag-and-Drop ✋

**Steps:**
1. Go to any notebook
2. Click "Edit Note" on a note with 3+ blocks
3. Hover over a block - **drag handle should appear** (6 dots icon)
4. Click and hold the drag handle
5. Drag block up or down
6. **Expected:** Block follows cursor, other blocks shift
7. Release to drop
8. **Expected:** Block stays in new position

**Verify in Database:**
```bash
psql $DATABASE_URL -c "
SELECT slot_id, lexorank_key, block_type, 
       LEFT(content_text, 30) as content_preview
FROM logical_block_slots
WHERE note_id = '<your-note-id>'
ORDER BY lexorank_key;
"
```

**Expected:** lexorank_key values should be ordered, with new midpoint calculated

---

### Test 2: Keyboard Shortcuts ⌨️

**Test Ctrl+S (Save):**
1. Click into a block's textarea
2. Type some new content
3. Press **Ctrl+S** (or Cmd+S on Mac)
4. **Expected:** 
   - Block saves immediately
   - Green "Saved" indicator appears
   - Textarea exits edit mode

**Test Esc (Cancel):**
1. Click into a block
2. Make changes
3. Press **Esc**
4. **Expected:**
   - Changes discarded
   - Original content restored
   - Edit mode canceled

---

### Test 3: Optimistic Updates 🚀

**Drag Test:**
1. Drag a block to new position
2. **Expected:** Block moves instantly (optimistic)
3. Wait 1-2 seconds
4. Refresh page
5. **Expected:** Block stays in new position (persisted)

**Edit Test:**
1. Edit a block
2. Click "Save"
3. **Expected:** "Saved" indicator appears immediately
4. Refresh page
5. **Expected:** Changes persisted

---

### Test 4: Loading States 🔄

**During Save:**
1. Edit a block
2. Click "Save"
3. **Watch for:**
   - Spinner icon appears
   - Button shows "Save" with spinning icon
   - Other buttons disabled
4. **After save:**
   - Green checkmark appears
   - "Saved" label shows for 2 seconds
   - Returns to normal

**During Drag:**
1. Drag a block
2. **Watch for:**
   - "Saving..." text in header
   - Block moves optimistically
3. **After save:**
   - Header returns to normal
   - No error banner

---

### Test 5: Error Handling ❌

**Simulate Error (force fail):**
1. Edit a block with invalid data (if validation exists)
2. OR: Disconnect from internet
3. Try to save
4. **Expected:**
   - Red error banner appears at top
   - Error message displayed
   - "Dismiss" button works
   - Changes not persisted

---

### Test 6: Visual Polish 🎨

**Check Icons:**
- Each block has correct icon:
  - Paragraph: AlignLeft icon
  - Heading: Type icon
  - Code: Code icon
  - Quote: Quote icon

**Check Drag Handle:**
- Appears on hover (GripVertical icon)
- Cursor changes to "grab" → "grabbing"
- Handle is touch-friendly (not too small)

**Check Transitions:**
- All state changes smooth
- No jarring movements
- Drag overlay looks good

---

### Test 7: Edge Cases 🧪

**Single Block:**
1. Note with only 1 block
2. Try to drag
3. **Expected:** Works but doesn't move anywhere

**Many Blocks (10+):**
1. Note with 10+ blocks
2. Drag first to last
3. **Expected:** Smooth scroll, proper drop

**Rapid Edits:**
1. Edit multiple blocks quickly
2. Save all rapidly
3. **Expected:** All save correctly, no race conditions

**Delete During Drag:**
1. Start dragging a block
2. Try to delete it
3. **Expected:** Delete button disabled during drag

---

## 🔍 What to Look For

### ✅ Success Indicators:
- Blocks reorder smoothly
- LexoRank values update in database
- New commits created for reorders
- No console errors
- Keyboard shortcuts work
- Success indicators appear
- Error banner dismisses

### ❌ Failure Indicators:
- Blocks jump or glitch during drag
- Blocks don't stay in new position after refresh
- Console errors (React warnings, TypeScript errors)
- Keyboard shortcuts don't work
- UI freezes or becomes unresponsive
- Error messages unclear

---

## 📊 Database Verification

### Check Commit History

After reordering blocks, verify commits:

```sql
SELECT 
  c.commit_id,
  c.commit_message,
  c.created_at,
  u.username
FROM commits c
JOIN branches b ON c.branch_id = b.branch_id
JOIN users u ON c.author_id = u.user_id
WHERE b.note_id = '<your-note-id>'
  AND b.is_main = TRUE
ORDER BY c.created_at DESC
LIMIT 5;
```

**Expected:** Should see "Reorder blocks" commits

### Check LexoRank Ordering

```sql
SELECT 
  lbs.slot_id,
  lbs.lexorank_key,
  lbs.block_type,
  LEFT(cb.content_text, 50) as preview
FROM logical_block_slots lbs
JOIN block_version_contents bvc ON bvc.slot_id = lbs.slot_id
JOIN content_blobs cb ON bvc.content_blob_hash = cb.sha256
WHERE lbs.note_id = '<your-note-id>'
ORDER BY lbs.lexorank_key;
```

**Expected:** 
- lexorank_key values in ascending order
- Matches visual order in editor
- Midpoint calculated correctly

---

## 🐛 Common Issues & Fixes

### Issue 1: Blocks Don't Stay After Refresh
**Cause:** reorderBlock Server Action not called  
**Check:** Browser console for errors  
**Fix:** Ensure `reorderBlock` imported correctly

### Issue 2: Drag Handle Doesn't Appear
**Cause:** CSS issue with hover states  
**Check:** Inspect element, check `group-hover:opacity-100`  
**Fix:** Ensure Tailwind classes applied

### Issue 3: LexoRank Collision
**Symptom:** Blocks at same position  
**Cause:** Midpoint calculation error  
**Check:** Database lexorank_key values  
**Fix:** Review `calculateLexoRankMidpoint` logic

### Issue 4: Keyboard Shortcuts Not Working
**Cause:** Event not preventing default  
**Check:** Browser console, test in different textarea  
**Fix:** Ensure `e.preventDefault()` called

---

## 📝 Test Results Template

After testing, report back with:

```markdown
## Phase 4 Test Results

**Date:** [date]
**Tester:** [name]
**Browser:** [Chrome/Firefox/Safari]

### Test Results:

1. **Drag-and-Drop:** ✅ PASS / ❌ FAIL
   - Notes: [any issues]

2. **Keyboard Shortcuts:** ✅ PASS / ❌ FAIL
   - Ctrl+S: [works/doesn't work]
   - Esc: [works/doesn't work]

3. **Optimistic Updates:** ✅ PASS / ❌ FAIL
   - Notes: [any issues]

4. **Loading States:** ✅ PASS / ❌ FAIL
   - Spinners: [visible/not visible]
   - Success indicators: [working/not working]

5. **Error Handling:** ✅ PASS / ❌ FAIL
   - Notes: [any issues]

6. **Visual Polish:** ✅ PASS / ❌ FAIL
   - Icons: [correct/incorrect]
   - Drag handle: [appears/doesn't appear]

7. **Edge Cases:** ✅ PASS / ❌ FAIL
   - Notes: [any issues]

### Database Verification:
- Commits created: ✅ YES / ❌ NO
- LexoRank updated: ✅ YES / ❌ NO
- Order persisted: ✅ YES / ❌ NO

### Console Errors:
[paste any errors, or write "None"]

### Overall Assessment:
- Functionality: [1-10]
- Performance: [fast/slow]
- UX Quality: [1-10]
- Ready for Phase 5: [YES/NO]
```

---

## 🎯 Success Criteria

Phase 4 is complete when:

- [x] Code implemented
- [x] Build passing
- [ ] **All 7 test cases pass**
- [ ] **Database verification successful**
- [ ] **No critical bugs found**
- [ ] **UX feels smooth and responsive**

---

## 🚀 Next Steps

**If all tests pass:**
- Mark Phase 4 complete ✅
- Update `detailed_architecture.md`
- Begin Phase 5: Branching & Merging

**If issues found:**
- Document specific failures
- Fix bugs
- Re-test
- Iterate until stable

---

**Status:** ⏸️ **Waiting for Human Testing**

**What I need from you:**
1. Run the tests above
2. Fill out the test results template
3. Report back with findings

**Then I can:**
- Fix any bugs found
- Or proceed to Phase 5 if everything works!

---

**Last Updated:** 2026-08-26  
**Implementation:** Complete  
**Testing:** Pending
