# BookWorm Issue Reports & Resolution Status

All issues reported below have been investigated, fixed, and verified against the production build.

---

### Issue 1: Non-Maintainers creating issues on notes
- **Report:** Non-maintainers can create issues on notes, example: `issue-f8e5f288/issue-by-non-maintainer`.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - In `src/actions/issues.ts` (`createIssue`), enforced that only users with `OWNER` or `MAINTAINER` role can open new issues on a note.
  - In `src/app/dashboard/notebooks/[notebookId]/notes/[noteId]/issues/issues-client.tsx`, hidden the "New Issue" creation button for Contributors/Viewers with an informative tooltip and badge explaining that maintainers open tasks and contributors attempt fixes on them.
  - Contributors submit fixes and proposals by attempting on open issues via isolated attempt branches.

---

### Issue 2: Collaborator permissions visibility for non-members
- **Report:** Non-contributor and non-maintainers cannot see the user permission list of a notebook.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - In `src/actions/permissions.ts` (`getResourceCollaborators`) and `src/lib/permissions.ts` (`getCollaborators`), removed the blocker restricting collaborator list viewing to members only. Any authenticated user can view the list of collaborators and authors for public/accessible notebooks.
  - Updated `src/components/permissions/PermissionsManager.tsx` to handle `currentUserRole: 'VIEWER' | 'NONE'`, hide role-modification and invitation controls, and added an intuitive "Request Access" workflow so viewers can request Contributor/Maintainer access directly.

---

### Issue 3: Block splitting deleting other blocks
- **Report:** Using the "Code" option after highlighting a block of text reformats (deletes the other blocks) the entire note's blocks.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - Root cause: `splitBlock` (and other block actions) previously selected the latest commit on `main` without checking `EXISTS (SELECT 1 FROM commit_manifests)`. An earlier empty commit had 0 manifests, causing subsequent commits to copy 0 rows and wipe out other blocks.
  - Updated `splitBlock`, `insertBlock`, `reorderBlock`, and `deleteBlock` in `src/actions/blocks.ts` to always query `EXISTS (SELECT 1 FROM commit_manifests cm WHERE cm.commit_id = c.commit_id)`.
  - Added an atomic backfill safeguard query to guarantees that all blocks in `logical_block_slots` for that note are persisted in the commit manifest.
  - Added the same manifest safeguard into `mergeBranch` in `src/actions/branches.ts`.

---

### Issue 4: Star system not prominent
- **Report:** Putting stars on notebooks does nothing, as in the amount of stars is not shown nor emphasised anywhere.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - Updated `Notebook` interface and queries in `src/actions/notebooks.ts` (`getNotebooks`, `getNotebook`) to return `stars_count` and `is_starred`.
  - Updated `Note` interface and queries in `src/actions/notes.ts` (`getNotesForNotebook`, `getNote`) to return `stars_count` and `is_starred`.
  - Enhanced `src/components/notes/StarButton.tsx` with optimistic count updates and badge display.
  - Integrated `StarButton` into every Notebook Card and Note Card on the dashboard (`dashboard-client.tsx`) and the Notebook Reader header (`reader.tsx`).

---

### Issue 5: Maintainer/Owner participation in issues & Universal block locking
- **Report:** Are maintainers/owners supposed to create issues and let only contributors handle that issue? Because maintainers/owners cannot edit on the issues created.
- **Requirement:** Maintainers/Owners must be able to submit their version on an issue, and while an issue is active, maintainers/owners should not be able to edit the block directly on `main`, ensuring strict consistency.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - In `src/actions/issues.ts`, verified `contributeToIssue` supports Maintainers and Owners. When an issue is open, a maintainer/owner can create their own attempt branch to submit their proposed version without overriding other contributors.
  - In `src/actions/blocks.ts` (`updateBlock`, `splitBlock`, `deleteBlock`), added an active issue check. If `branchRecord.is_main` is true and an active issue (`OPEN` or `IN_PROGRESS`) targets the slot, direct modification on `main` is strictly rejected.
  - In `src/app/dashboard/notebooks/[notebookId]/notes/[noteId]/edit/editor.tsx`, displayed a distinct amber lock banner `🔒 Locked by Active Issue: "[title]"` on `main`, disabled direct textarea editing on that block, and added a `"Work on Issue Branch"` CTA that automatically creates an attempt branch and switches the user to it.

---

### Issue 6: Light mode bugs and aesthetics
- **Report:** The light mode is buggy and does not look good.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - In `src/app/globals.css`, resolved unmapped dark Tailwind utility classes (`.bg-zinc-950`, `.bg-zinc-900`, `.border-zinc-800`, `.bg-amber-950/20`, etc.).
  - Re-themed light mode following Apple Sequoia aesthetics: crisp white cards (`#ffffff`), luminous canvas backdrop (`#edf0f5`), delicate borders (`rgba(0,0,0,0.1)`), elevated frosted headers, and high-contrast typography (`#111827`).
  - Styled modals and dialogs so light mode text and inputs are legible and bug-free.

---

### Issue 7: Dashboard New Branch and New Fork actions
- **Report:** In the dashboard, the option to create branches and/or forking a note does nothing for now.
- **Status:** ✅ **RESOLVED**
- **Fix:**
  - In `src/app/dashboard/dashboard-client.tsx`, connected the `CreateResourceModal` to real backend actions:
    - **Forking:** Provides cascading Source Notebook -> Source Note -> Destination Notebook selector and calls `forkNote(...)`, redirecting the user to the newly forked note.
    - **Branching:** Provides cascading Notebook -> Note selector with options to either attempt an existing open issue (`contributeToIssue`) OR target a block to lock & create a new attempt branch (`createIssue`), then immediately routes to the branch editor.