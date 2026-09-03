# BookWorm - Issue Reports & Resolution Tracker

**Status:** All reported issues have been investigated, addressed in codebase, and compile-checked (`npm run build` passed).  
**Verification State:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`

---

## 📊 Summary Status Table

| Issue ID | Category | Summary | Status | Verified |
|:---|:---|:---|:---|:---:|
| **ISSUE-01** | Editor / UX | `+ Insert Block (Ctrl + Enter)` requires refresh to show | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-02** | Navigation | Empty Notebook "Create First Note" button unresponsive | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-03** | Editions | Published Edition indentation & code formatting corrupted | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-04** | VC & Branches | Issue attempt branch text confuses/conflicts with main branch | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-05** | Permissions | Notebooks cannot change visibility/access after creation | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-06** | Contributor VC | Contributor getting "Insufficient permissions" on attempt branch | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-07** | Privacy | Unrelated public notebooks leaking into dashboard sidebar | 🟡 Potentially Fixed | [ ] Needs Verification |
| **ISSUE-08** | RBAC / Invites | Collaborators added directly instead of receiving invitation | 🟡 Potentially Fixed | [ ] Needs Verification |

---

## 🔍 Detailed Issue Breakdown & Verification Guide

### ISSUE-01: Block Not Appearing Immediately After Insertion
- **Reported Behavior:** Pressing `+ Insert Block` (or `Ctrl + Enter`) inserts the block into the database, but it does not immediately appear in the editor UI until the page is refreshed.
- **Root Cause:** `handleInsertBlock` triggered server revalidation (`router.refresh()`), but React local `blocks` state was not updated optimistically.
- **Fix Applied:** 
  - Updated [src/actions/blocks.ts](file:///home/thepg/Projects/BookWorm/bookworm/src/actions/blocks.ts) to return the new slot ID, version ID, and calculated LexoRank key.
  - Updated [editor.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/app/dashboard/notebooks/[notebookId]/notes/[noteId]/edit/editor.tsx) to immediately prepend/splice the new block object into `blocks` state.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. Open any note in the editor.
  2. Click **+ Insert Block** or hover between two blocks and select a block type (or press `Ctrl + Enter`).
  3. Verify that the new block appears instantly in the list without page reload.

---

### ISSUE-02: Empty Notebook "Create First Note" Button Unresponsive
- **Reported Behavior:** When entering an empty notebook via "Read Notebook", clicking "Create First Note" had no effect; required going through "Manage Notes".
- **Root Cause:** In [reader.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/app/dashboard/notebooks/[notebookId]/reader.tsx), the button was an unattached `<button>` tag without an `onClick` or navigation link.
- **Fix Applied:** Replaced the dead button with a Next.js `<Link>` pointing directly to `/dashboard/notebooks/[notebookId]/manage`.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. Create or open an empty notebook.
  2. Click **Read Notebook**.
  3. Click the **Create First Note** button.
  4. Verify it takes you to the notebook management page where you can create notes.

---

### ISSUE-03: Published Edition Formatting & Indentation Loss
- **Reported Behavior:** After publishing an Edition of a note, indentation and code formatting was stripped inside the public edition reader.
- **Root Cause:** [edition-client.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/app/e/[shareCode]/edition-client.tsx) used a naive regex parser that executed `.trim()` on each line, collapsing indentations and breaking code blocks.
- **Fix Applied:** Replaced custom naive parser with `<RobustMarkdown />` parser supporting GitHub-flavored markdown, indented lists, blockquotes, and syntax-highlighted code blocks.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. Create a note with indented code blocks, sub-lists, and blockquotes.
  2. Publish a new Edition (Snapshot) and copy the share link (`/e/[shareCode]`).
  3. Open the link and verify indentation, code blocks, and markdown structure are preserved.

---

### ISSUE-04: Issue Branch vs. Main Branch Editing Isolation
- **Reported Behavior:** When editing a block on an issue attempt branch, the text was not properly saved to that specific branch; instead, the program confused the main branch and issue branch, causing text bugs and cross-branch bleed.
- **Root Cause:**
  1. In [editor.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/app/dashboard/notebooks/[notebookId]/notes/[noteId]/edit/editor.tsx), `handleSaveBlock` lacked `currentBranch` in its `useCallback` dependency array, creating a stale closure where edits were submitted targeting the initial branch (often `main`).
  2. Switching branches via `?branch=` did not resynchronize the local `blocks` state with the server-rendered `note.blocks`.
  3. In [src/actions/blocks.ts](file:///home/thepg/Projects/BookWorm/bookworm/src/actions/blocks.ts), `updateBlock` copy manifest logic was enhanced to strictly preserve non-target slots and cleanly isolate changes to the branch's commit chain.
- **Fix Applied:**
  - Added `useEffect` in `editor.tsx` to resync `blocks` on `currentBranch?.branch_id` change.
  - Added `currentBranch` to dependency arrays for `handleSaveBlock`, `handleInsertBlock`, `handleDeleteBlock`, and `handleSplitBlock`.
  - Bulletproofed `updateBlock` branch commit manifests.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. Open a note with an active issue and an attempt branch.
  2. Switch to the attempt branch in the branch switcher dropdown.
  3. Edit the locked block with text "Attempt branch revision". Save block.
  4. Switch back to the `main` branch.
  5. Verify the `main` branch still displays its original text without bleeding the attempt text.
  6. Switch back to the attempt branch and verify your branch-specific revision is intact.

---

### ISSUE-05: Changing Notebook Visibility & Access Permissions
- **Reported Behavior:** Notebooks once created could not change their access visibility (e.g. from private to public).
- **Fix Applied:**
  - Updated [src/actions/notebooks.ts](file:///home/thepg/Projects/BookWorm/bookworm/src/actions/notebooks.ts) `updateNotebook` with clean parameterized SQL.
  - Added a **Settings & Visibility** tab in [manage-client.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/app/dashboard/notebooks/[notebookId]/manage-client.tsx) allowing Owners/Maintainers to update title, description, and toggle visibility between **Public**, **Unlisted**, and **Private**.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. Navigate to a notebook and click **Manage Notebook**.
  2. Click the new **Settings & Visibility** tab.
  3. Change visibility (e.g., from `Private` to `Public`) and click **Save Changes**.
  4. Verify the toast confirms the update and the badge reflects the new visibility.

---

### ISSUE-06: Contributor Permission on Assigned Issue Branch
- **Reported Behavior:** When a contributor attempted to edit a block on their issue branch, they received an "Insufficient permissions to edit this note" error.
- **Root Cause:** `updateBlock` was checking for notebook-level `OWNER` or `MAINTAINER` role, rejecting contributors even when editing their own authorized issue branch.
- **Fix Applied:** [src/actions/blocks.ts](file:///home/thepg/Projects/BookWorm/bookworm/src/actions/blocks.ts) permits contributors to edit if they are editing their own assigned branch that targets that specific slot.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. Sign in as a contributor assigned to an issue.
  2. Switch to the contributor's issue branch.
  3. Edit the target block and click Save.
  4. Verify the edit succeeds without an "Insufficient permissions" error.

---

### ISSUE-07: Public Notebooks Leaking into Unaffiliated User Dashboards
- **Reported Behavior:** If `user_3` created a public notebook, `user_2` saw that notebook in their personal dashboard sidebar despite having no collaborator role in it.
- **Root Cause:** In [src/actions/notebooks.ts](file:///home/thepg/Projects/BookWorm/bookworm/src/actions/notebooks.ts), `getNotebooks(userId)` contained `OR nb.visibility = 'PUBLIC'`.
- **Fix Applied:** Removed `OR nb.visibility = 'PUBLIC'` from `getNotebooks(userId)`. Personal sidebars now exclusively list notebooks where the user is an Owner, Maintainer, or Contributor. Public notebooks remain discoverable via `/explore` and global search.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. As `user_3`, create a new Public notebook.
  2. Sign in as `user_2` (who is neither owner nor collaborator).
  3. Check the left sidebar on the dashboard: verify the notebook does NOT appear in `user_2`'s personal collection.
  4. Open `/explore` or the search modal and verify the public notebook is discoverable there.

---

### ISSUE-08: Direct Collaborator Addition vs. Invitation & Acceptance Lifecycle
- **Reported Behavior:** When a notebook owner invited another user, the invited user directly received access instead of first receiving an invitation.
- **Fix Applied:**
  - In [src/actions/permissions.ts](file:///home/thepg/Projects/BookWorm/bookworm/src/actions/permissions.ts), `addCollaborator` / `inviteCollaborator` now creates a pending record in `access_requests` with `direction = 'INVITE'` and `status = 'PENDING'`, and dispatches a notification.
  - Added `respondToInvitation` action to handle **Accept** (grants role) and **Decline** (marks rejected).
  - Added a **Collaboration Invitation Banner** at the top of [dashboard-client.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/app/dashboard/dashboard-client.tsx) with **Accept Invitation** and **Decline** buttons.
  - Updated [PermissionsManager.tsx](file:///home/thepg/Projects/BookWorm/bookworm/src/components/permissions/PermissionsManager.tsx) to list sent invitations with an `Awaiting User Acceptance` badge and a **Cancel Invite** button.
- **Status:** `[POTENTIALLY FIXED - MANUAL VERIFICATION REQUIRED]`
- **How to Manually Verify:**
  1. As `user_1` (Owner), go to notebook **Manage** → **Permissions**.
  2. Invite `user_2` as `CONTRIBUTOR`.
  3. Verify the request appears under "Requests" as `Awaiting User Acceptance`.
  4. Sign in as `user_2` and visit `/dashboard`.
  5. Verify the **Collaboration Invitation** banner appears at the top.
  6. Click **Accept Invitation**; verify the notebook now appears in `user_2`'s sidebar.