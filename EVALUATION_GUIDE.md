# BookWorm — BUET CSE 216 (Database Sessional) 60% Evaluation Walkthrough Guide

**Project:** BookWorm — Git-like Version Control for Structured Notes  
**Course:** CSE 216 (Database Systems Sessional), Department of CSE, BUET  
**Database:** PostgreSQL 16 (Hosted via Neon Serverless)  
**Backend:** Next.js 15 App Router, TypeScript, Raw Parameterized SQL (`@neondatabase/serverless`) — **Zero ORM**  
**Design:** Apple Frosted Glass / Glassmorphism Aesthetic with Dark & Light Modes  

---

## 🎯 1. Evaluation Demonstration Script (5-10 Minutes)

Follow this step-by-step sequence in front of the examiners to systematically prove compliance with **Sections 3.1, 3.2, 3.3, 3.4, and 4.0**.

### Step 1: Open the Application & Point Out the Aesthetic
1. Navigate to: [`http://localhost:3000`](http://localhost:3000)
2. **Demonstrate Apple Frosted Glass & Theme Toggle (Requirement 3.4):**
   - Click the **Sun / Moon icon** in the top navigation bar.
   - Show how the UI instantly transitions between **Dark Obsidian Glass** and **macOS Crisp Light Glass** with subtle blur filters and translucent panels.

---

### Step 2: Authentication & Password Security (Requirement 3.1)
1. **Explain the Hashing Implementation:**
   - *"All user passwords are stored using cryptographically salted PBKDF2 SHA-512 with unique 16-byte random salts per user, not plain text or simple MD5/SHA-1."*
2. **Sign In:**
   - Sign in using:
     - **Email:** `alice@bookworm.dev`
     - **Password:** `password`
3. **Session Cookie & DB-Resolved Roles:**
   - Open Chrome DevTools -> **Application** -> **Cookies** -> `bookworm_session`.
   - Show that the session cookie is **HTTP-Only, Secure, and SameSite=Lax**.
   - Show the top-right role badge: `@alice (ADMIN / OWNER)`. Roles are fetched directly from the database table (`system_role` on `users` and `collaborator_roles`), never trusted from client storage.

---

### Step 3: Automated BUET Evaluation Audit Tool (Requirements 3.2 & 3.3)
1. In the top navigation bar, click the green **"Evaluation Audit"** button.
2. Click **"Run Automated Compliance Audit"**.
3. Watch the modal run live HTTP requests against the backend and verify all 5 test scenarios:
   - ✅ **3.1 Auth Enforcement:** Unauthenticated call returns **401 Unauthorized**.
   - ✅ **3.1 Auth Credential Check:** Invalid password returns **401 Unauthorized**.
   - ✅ **3.2 Object Ownership Enforcement:** Contributor attempting to delete a notebook returns **403 Forbidden**.
   - ✅ **3.2 Role Separation:** Contributor attempting to merge a branch returns **403 Forbidden**.
   - ✅ **3.3 Conflict Handling:** Opening an issue on an already locked block returns **409 Conflict**.

---

### Step 4: Live Role Switcher Demonstration (Requirement 3.2)
Use the **Role Switcher dropdown** (click `@alice` in the top bar) to seamlessly switch users:

1. **Switch to Bob (`bob@bookworm.dev` - MAINTAINER):**
   - Show that Bob has maintainer permissions: he can review branches and approve merges.
   - Demonstrate that if Bob tries to delete Alice's notebook via the API, the database and server reject it with **403 Forbidden**.
2. **Switch to Charlie (`charlie@bookworm.dev` - CONTRIBUTOR):**
   - Show that Charlie can create drafts and propose edits.
   - Show that Charlie's merge button is disabled, and attempting to call `/api/branches/[id]/merge` returns **403 Forbidden**.
3. **Switch to Diana (`diana@bookworm.dev` - OUTSIDER):**
   - Diana does not have collaborator roles on private notebooks.
   - Modifying URL parameters to view Alice's private notes immediately rejects her with **403 Forbidden** (object-level access control).

---

### Step 5: Interactive Circular DAG Tree Visualizer
1. As **Alice**, open the note **"B-Trees & Page-Structured Storage"**.
2. In the top toolbar, click the **"Tree"** button (or navigate to `/dashboard/notebooks/.../notes/.../tree`).
3. **Demonstrate the Interactive DAG:**
   - Point out the **circular commit nodes** and **curved SVG Bezier connecting tracks**:
     - 🟢 **Emerald Lane 0:** The canonical `main` branch.
     - 🔵 **Cyan / Purple Lanes:** Collaborative issue attempt branches.
     - 🟣 **Dashed Curves:** True merge commits (`merge_parent_commit_id`).
   - **Click on ANY circular commit node:**
     - The right-side **Commit Block Inspector** instantly renders every single content block at that exact commit, reconstructed live from the database ternary manifests (`commit_manifests` -> `block_version_contents` -> `content_blobs`).
     - Point out the **SHA-256 CAS hash** on each block.

---

### Step 6: Zero-Cost Note Forking (CAS Deduplication)
1. On the note reader page, click the cyan **"Fork Note"** button.
2. The modal appears with the visual pipeline:
   `Source Note -> SHA-256 CAS Engine -> Destination Workspace`.
3. Choose a destination notebook and click **"Confirm Zero-Cost Fork"**.
4. **Explain to the Examiner:**
   - *"Notice that 0 extra disk bytes were consumed. The new note's commits reference the existing immutable SHA-256 content blobs in `content_blobs`. Text is only copied on-write when a block is modified."*

---

### Step 7: Public Edition Publishing & Exporter (Phase 8)
1. Click the purple **"Editions"** button on the note page.
2. Select **"Publish New Snapshot"** -> enter version `v1.0.0` -> click Publish.
3. Open the generated link: [`http://localhost:3000/e/cs101-release-v1`](http://localhost:3000/e/cs101-release-v1).
4. Show that anyone without an account can view the note, click **"Export .md"** to download the Markdown file, or click **"PDF"** to print.

---

## 💻 2. Command Line (cURL) Test Suite for Examiners (Requirement 3.3)

Run these commands in a separate terminal during the demonstration to prove raw HTTP status codes:

### 1. Test 401 Unauthorized (Unauthenticated API call)
```bash
curl -i -X GET http://localhost:3000/api/auth/me
# Expected Output: HTTP/1.1 401 Unauthorized
```

### 2. Test 200 OK (Authentication & Cookie Provisioning)
```bash
curl -i -c cookie.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@bookworm.dev","password":"password"}'
# Expected Output: HTTP/1.1 200 OK + Set-Cookie: bookworm_session=...
```

### 3. Test 403 Forbidden (Contributor attempting Maintainer Action)
```bash
# Log in as Charlie (Contributor)
curl -s -c charlie_cookie.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@bookworm.dev","password":"password"}' > /dev/null

# Attempt to merge a branch as Charlie
curl -i -b charlie_cookie.txt -X POST http://localhost:3000/api/branches/850e8400-e29b-41d4-a716-446655440003/merge
# Expected Output: HTTP/1.1 403 Forbidden {"error":"Forbidden. Branch merge capability requires MAINTAINER or OWNER role. Contributors can only draft attempt branches.","required_roles":["OWNER","MAINTAINER"],"your_role":"CONTRIBUTOR"}
```

### 4. Test 409 Conflict (Duplicate Resource or Conflicting Block Lock)
```bash
# Attempt to register an existing email
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@bookworm.dev","password":"password"}'
# Expected Output: HTTP/1.1 409 Conflict {"error":"Username or email is already registered"}
```

### 5. Test 201 Created (New Notebook Creation)
```bash
curl -i -b cookie.txt -X POST http://localhost:3000/api/notebooks \
  -H "Content-Type: application/json" \
  -d '{"title":"Compiler Design & LLVM IR"}'
# Expected Output: HTTP/1.1 201 Created {"success":true,...}
```

---

## 🎓 3. Answers to Likely Questions by Examiners

### Q1: Why is there NO ORM (e.g. Prisma, Drizzle, TypeORM)? (Requirement 4.0)
> *"For CSE 216 Database Sessional, our objective is to demonstrate raw SQL mastery. We use `@neondatabase/serverless` tagged template literals (`sql`...``). Every query is parameterized to prevent SQL injection while utilizing advanced PostgreSQL features such as Recursive CTEs, LATERAL joins, Partial Unique Indexes, and Composite Foreign Keys that ORMs typically abstract away or struggle to optimize."*

### Q2: How does your ISA Supertype hierarchy work?
> *"In `schema.sql`, we have a supertype table `resources` with primary key `resource_id` and discriminator `resource_type IN ('NOTEBOOK', 'NOTE')`. Both `notebooks` and `notes` share this key as their primary key and foreign key. This allows `collaborator_roles` to assign permissions uniformly across both notebooks and individual notes via a single unified relationship."*

### Q3: How do you guarantee ZERO merge conflicts?
> *"Git operates on line-based diffs, which causes conflicts when two developers touch adjacent lines. BookWorm solves this at the database schema level:*
> 1. *Edits target specific blocks (`slot_id`).*
> 2. *When an issue is opened, a Partial Unique Index (`idx_one_active_issue_per_slot`) locks that specific slot so no two competing issues can target the same block simultaneously.*
> 3. *When a maintainer selects a winning branch to merge, only that specific slot's pointer in `commit_manifests` is updated.*
> 4. *All other blocks in the note are unaffected, guaranteeing conflict-free merges by mathematical construction."*

### Q4: How does Content-Addressed Storage (CAS) save storage?
> *"Every text block is hashed with SHA-256. The text is stored in `content_blobs` where `sha256` is the primary key. When notes are forked or when identical text is committed, `INSERT ... ON CONFLICT (sha256) DO NOTHING` prevents storing duplicate strings. Multiple versions simply reference the same immutable hash."*

### Q5: How does LexoRank achieve O(1) block reordering?
> *"Traditional ordering uses sequential integers (1, 2, 3...). Moving block 10 to position 2 requires updating every subsequent row (O(N) write amplification). LexoRank assigns string keys (e.g. `1|100000`, `1|200000`). Inserting between them computes the alphanumeric midpoint (`1|150000`), updating only the single moved block in O(1) time."*

---

## 🔑 4. Test Accounts & Pre-Seeded Credentials

| Username | Email | Password | System Role | Notebook Role | Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Alice Walker** | `alice@bookworm.dev` | `password` | `ADMIN` | `OWNER` | Full access, delete notebooks, approve requests, publish editions. |
| **Bob Chen** | `bob@bookworm.dev` | `USER` | `MAINTAINER` | Can approve requests, commit, and merge; cannot delete notebooks (403). |
| **Charlie Davis** | `charlie@bookworm.dev` | `USER` | `CONTRIBUTOR` | Can open issues and commit to branches; cannot merge (403). |
| **Diana Prince** | `diana@bookworm.dev` | `USER` | `OUTSIDER` | Cannot view or modify private notes (403). |

---

## 📁 5. Repository Deliverables Checklist
- [x] [`schema.sql`](file:///home/thepg/Projects/BookWorm/bookworm/schema.sql) — DDL with ISA hierarchy, CAS tables, and partial indexes
- [x] [`rebuild_database.sql`](file:///home/thepg/Projects/BookWorm/bookworm/rebuild_database.sql) — 1-click database reset and warm-up script with realistic computer science notes
- [x] [`migrations/`](file:///home/thepg/Projects/BookWorm/bookworm/migrations) — All 5 incremental SQL migration files
- [x] [`src/app/api/`](file:///home/thepg/Projects/BookWorm/bookworm/src/app/api) — Full REST API suite returning proper HTTP status codes
- [x] `EVALUATION_GUIDE.md` — This comprehensive demonstration walkthrough
