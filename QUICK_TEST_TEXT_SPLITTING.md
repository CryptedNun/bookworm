# Quick Test: Text Splitting Feature ⚡

**What to test:** Select text within blocks and split them into separate blocks

---

## 🚀 Start Testing (2 minutes)

### 1. Start the dev server
```bash
npm run dev
```

### 2. Navigate to editor
```
http://localhost:3000
→ Sign in
→ Click any notebook
→ Click any note
→ Click "Edit" button
```

---

## ✅ 7 Quick Tests

### Test 1: Basic Split (30 seconds)
1. Type in any block: `Introduction. This is the main point. Conclusion.`
2. Select with mouse: `This is the main point.`
3. Press `Ctrl+/` on keyboard
4. Click "Code" in the menu that appears
5. **Expected:** 3 blocks appear:
   - `Introduction. `
   - `This is the main point.` (as CODE block)
   - ` Conclusion.`

### Test 2: Keyboard Shortcut (20 seconds)
1. Type in a block: `Before text. Selected text. After text.`
2. Select: `Selected text.`
3. Press `Ctrl+Shift+H` (direct shortcut for Heading)
4. **Expected:** 3 blocks, middle one is HEADING type

### Test 3: Split from Beginning (20 seconds)
1. Type: `Selected part. Rest of the text.`
2. Select from start: `Selected part.`
3. Press `Ctrl+/`, choose "Quote"
4. **Expected:** 2 blocks (selected becomes QUOTE)

### Test 4: Split to End (20 seconds)
1. Type: `Start of text. Selected part.`
2. Select to end: `Selected part.`
3. Press `Ctrl+Shift+P` (Paragraph)
4. **Expected:** 2 blocks (selected becomes PARAGRAPH)

### Test 5: Drag After Split (20 seconds)
1. Split a block into 3 parts (Test 1)
2. Drag the middle block up or down
3. **Expected:** Blocks reorder smoothly, maintain text

### Test 6: Menu Behavior (20 seconds)
1. Select text, press `Ctrl+/`
2. Press `Escape`
3. **Expected:** Menu closes
4. Select text again, press `Ctrl+/`
5. Click outside the menu
6. **Expected:** Menu closes

### Test 7: All Shortcuts (30 seconds)
Select different text in blocks and test:
- `Ctrl+Shift+P` → Paragraph ✅
- `Ctrl+Shift+H` → Heading ✅
- `Ctrl+Shift+C` → Code ✅
- `Ctrl+Shift+Q` → Quote ✅

---

## 🎯 What Success Looks Like

**When splitting text, you should see:**
- ✅ Menu appears near selected text
- ✅ 4 block type options with keyboard shortcuts shown
- ✅ After clicking: "Saving..." indicator appears
- ✅ Blocks split correctly (1-3 new blocks depending on selection)
- ✅ Green "Saved" checkmark appears briefly
- ✅ Page refreshes with new blocks in correct order
- ✅ Drag handles work on all blocks
- ✅ Can split the resulting blocks again

---

## 🐛 If Something Goes Wrong

**Menu doesn't appear:**
- Make sure you selected at least 2 characters
- Press `Ctrl+/` while textarea is focused
- Check browser console (F12) for errors

**Split doesn't work:**
- Check for error banner at top of page
- Look in browser console (F12) for error details
- Verify database connection in `.env.local`

**Blocks in wrong order:**
- Refresh the page
- Check if drag-and-drop is working separately

**Report issues with:**
- What you did (steps)
- What you expected
- What actually happened
- Browser console errors (F12 → Console tab)

---

## 📊 Visual Guide

### Selection Menu
```
┌─────────────────────────────────┐
│ Split selection as:             │
├─────────────────────────────────┤
│ 📄 Paragraph    Ctrl+Shift+P    │
│ # Heading       Ctrl+Shift+H    │
│ <> Code         Ctrl+Shift+C    │
│ " Quote         Ctrl+Shift+Q    │
├─────────────────────────────────┤
│ ✂️ Tip: Select text and press   │
│   Ctrl+/ to open this menu      │
└─────────────────────────────────┘
```

### Split Result (3 blocks from middle)
```
Before split:
┌────────────────────────────────────┐
│ PARAGRAPH                          │
│ Before. Middle section. After.     │
└────────────────────────────────────┘

After selecting "Middle section" and choosing CODE:
┌────────────────────────────────────┐
│ PARAGRAPH                          │
│ Before.                            │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ CODE                               │
│ Middle section.                    │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ PARAGRAPH                          │
│ After.                             │
└────────────────────────────────────┘
```

---

## ⏱️ Total Testing Time: ~3 minutes

Once you've confirmed all 7 tests pass, the feature is ready! 🎉

---

**Next:** Report results back and we'll proceed to Phase 5 (Branching & Merging)
