# BookWorm - Human-Required Tasks Guide

**For tasks that agents CANNOT perform and require your direct action**

---

## 🚨 Why This Document Exists

AI agents (Claude, GPT, etc.) have limitations in:
- Installing system packages
- Modifying external services (Neon console, Vercel, GitHub settings)
- Running terminal commands persistently
- Configuring local development tools
- Accessing browser-based interfaces

**This document lists ALL tasks that need YOUR action, with:**
1. ✅ **What to do** - Exact steps
2. 🎯 **Why it's needed** - Purpose and context
3. 📋 **How to verify** - Confirmation checks
4. 🤖 **What to tell the agent after** - Handoff info

---

## Table of Contents

1. [Initial Project Setup](#1-initial-project-setup)
2. [Database Setup & Access](#2-database-setup--access)
3. [Development Environment](#3-development-environment)
4. [Testing & Debugging](#4-testing--debugging)
5. [Deployment Tasks](#5-deployment-tasks)
6. [Git & Version Control](#6-git--version-control)
7. [External Service Configuration](#7-external-service-configuration)

---

## 1. Initial Project Setup

### Task 1.1: Install Node.js Dependencies

**What agents CANNOT do:** Run `npm install`

**What YOU need to do:**
```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm install
```

**Why it's needed:**
- Installs all packages from `package.json`
- Required before running dev server
- Sets up node_modules

**How to verify:**
```bash
# Check if node_modules exists
ls -la node_modules

# Should see folders like:
# - next/
# - react/
# - @neondatabase/
# - lucide-react/
# - typescript/
```

**What to tell the agent after:**
> ✅ "Dependencies installed. node_modules directory created with [number] packages."

---

### Task 1.2: Create .env.local File

**What agents CAN do:** Provide the content  
**What YOU need to do:** Create the file

**Steps:**
```bash
cd /home/thepg/Projects/BookWorm/bookworm

# Create .env.local with your editor or:
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

**Why it's needed:**
- Environment variables for database connection
- Not committed to git (in .gitignore)
- Required for app to connect to Neon

**How to verify:**
```bash
# Check file exists
cat .env.local

# Should show DATABASE_URL and other vars
```

**What to tell the agent after:**
> ✅ ".env.local created with DATABASE_URL configured. Ready for database connection."

---

### Task 1.3: Start Development Server

**What agents CANNOT do:** Run persistent dev server

**What YOU need to do:**
```bash
cd /home/thepg/Projects/BookWorm/bookworm
npm run dev
```

**Why it's needed:**
- Starts Next.js on http://localhost:3000
- Required to test any frontend changes
- Hot-reloads on file changes

**How to verify:**
```bash
# Terminal should show:
# ▲ Next.js 16.3.0
# - Local: http://localhost:3000
# ✓ Ready in [time]

# Open browser to http://localhost:3000
# Should see BookWorm landing page
```

**What to tell the agent after:**
> ✅ "Dev server running on localhost:3000. Landing page loads successfully."

---

## 2. Database Setup & Access

### Task 2.1: Initialize Database Schema

**What agents CAN do:** Provide the SQL file  
**What YOU need to do:** Run it against Neon

**Steps:**
```bash
# Option 1: Using psql command line
psql "postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" -f schema.sql

# Option 2: Using Neon Console
# 1. Open https://console.neon.tech
# 2. Navigate to your project
# 3. Open SQL Editor
# 4. Copy-paste schema.sql content
# 5. Click "Run"
```

**Why it's needed:**
- Creates all 15 tables
- Sets up constraints, triggers, indexes
- Must be done before running seed data

**How to verify:**
```bash
# Query to check tables created
psql $DATABASE_URL -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name;
"

# Should show 15 tables:
# access_requests
# block_version_contents
# branches
# collaborator_roles
# commit_manifests
# commits
# content_blobs
# editions
# issue_contributors
# issues
# logical_block_slots
# notebooks
# notes
# resources
# users
```

**What to tell the agent after:**
> ✅ "Schema initialized. All 15 tables created successfully. Ready for seed data."

---

### Task 2.2: Load Seed Data

**What agents CAN do:** Provide warm_up.sql  
**What YOU need to do:** Run it

**Steps:**
```bash
# Run seed data SQL
psql "postgresql://neondb_owner:npg_Xy8f1FaHcVCU@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" -f warm_up.sql
```

**Why it's needed:**
- Populates tables with test users
- Creates sample notebooks and notes
- Required for testing authentication

**How to verify:**
```bash
# Check users created
psql $DATABASE_URL -c "SELECT username, email FROM users;"

# Should show:
# alice | alice@bookworm.dev
# bob   | bob@bookworm.dev
# charlie | charlie@bookworm.dev
```

**What to tell the agent after:**
> ✅ "Seed data loaded. 3 test users created (alice, bob, charlie). Sample notebooks available."

---

### Task 2.3: Access Neon Console for Debugging

**What agents CANNOT do:** Open browser interfaces

**What YOU need to do:**
1. Open https://console.neon.tech
2. Sign in to your account
3. Navigate to your project
4. Use SQL Editor for manual queries

**Why it's needed:**
- Debugging failed queries
- Viewing table contents
- Checking constraints
- Manual data fixes

**When to use:**
- Agent reports database error
- Need to verify data state
- Testing complex queries
- Troubleshooting constraints

**What to tell the agent after:**
> "Neon console open. Found [issue description]. [Data state description]."

Example:
> "Neon console open. Found duplicate notebook entry. Deleted manually. Ready to retry createNotebook action."

---

## 3. Development Environment

### Task 3.1: Install psql CLI Tool

**What agents CANNOT do:** Install system packages

**What YOU need to do:**

**On Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-client
```

**On macOS:**
```bash
brew install postgresql
```

**On Windows:**
- Download from https://www.postgresql.org/download/windows/
- Or use WSL with Ubuntu instructions

**Why it's needed:**
- Run SQL files against Neon
- Quick database verification
- Testing queries directly

**How to verify:**
```bash
psql --version
# Should show: psql (PostgreSQL) 14.x or higher

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
# Should return: 1
```

**What to tell the agent after:**
> ✅ "psql installed (version X.X). Can connect to Neon. Ready for SQL commands."

---

### Task 3.2: Set Up Git Hooks (Optional)

**What agents CAN do:** Provide hook scripts  
**What YOU need to do:** Install them

**Steps:**
```bash
# Example: Pre-commit hook to check TypeScript
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
npm run lint
npx tsc --noEmit
EOF

chmod +x .git/hooks/pre-commit
```

**Why it's needed:**
- Prevents committing broken code
- Runs type checks before commit
- Maintains code quality

**How to verify:**
```bash
# Make a change and try to commit
git add .
git commit -m "test"

# Should run lint and type check first
```

**What to tell the agent after:**
> ✅ "Git hooks configured. Pre-commit checks enabled."

---

## 4. Testing & Debugging

### Task 4.1: Test Server Actions in Browser

**What agents CANNOT do:** Interact with browser UI

**What YOU need to do:**
1. Start dev server (`npm run dev`)
2. Open http://localhost:3000
3. Navigate to relevant page
4. Fill out form
5. Submit and observe results
6. Report back to agent

**Why it's needed:**
- Verify Server Actions work
- Test user flows
- Catch UI bugs
- Validate form submissions

**Testing checklist template:**
```markdown
## Test Results - [Feature Name]

**Test Date:** [Date]

### Happy Path
- [ ] Form loads correctly
- [ ] Can fill all required fields
- [ ] Submit button works
- [ ] Success message appears
- [ ] Data appears in database
- [ ] UI updates correctly

### Error Cases
- [ ] Empty required field shows error
- [ ] Invalid input rejected
- [ ] Network error handled
- [ ] Database error handled
- [ ] Error messages clear

### Database Verification
```sql
-- Query used to verify
SELECT * FROM table_name WHERE condition;
```

**Result:** [Describe what you found]

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Screenshots:** [If applicable]
```

**What to tell the agent after:**
> "Tested createNotebook action. Happy path works ✅. Found issue: [description]. Database query shows [result]."

---

### Task 4.2: Check Browser Console for Errors

**What agents CANNOT do:** View browser developer tools

**What YOU need to do:**
1. Open browser Dev Tools (F12)
2. Go to Console tab
3. Reproduce the issue
4. Copy any error messages
5. Go to Network tab
6. Check failed requests
7. Report findings to agent

**Why it's needed:**
- Client-side JavaScript errors
- Failed API calls
- Network issues
- React rendering problems

**Error reporting template:**
```markdown
## Browser Error Report

**Page:** /dashboard
**Action:** Clicked "Create Notebook"

### Console Errors:
```
[Copy-paste exact error messages]
```

### Network Tab:
- Request: POST /api/notebooks
- Status: 500 Internal Server Error
- Response:
```json
{
  "error": "Database connection failed"
}
```

### Additional Context:
- Browser: Chrome 120
- Timestamp: [Time]
- User: alice@bookworm.dev
```

**What to tell the agent after:**
> "Console shows error: '[exact error message]'. Network tab shows 500 error on POST /api/notebooks. Response body: '[error details]'."

---

### Task 4.3: Run Direct SQL Queries for Debugging

**What agents CAN do:** Provide the SQL  
**What YOU need to do:** Execute and report results

**Steps:**
```bash
# Agent provides query like:
psql $DATABASE_URL -c "
  SELECT 
    n.title,
    r.resource_type,
    cr.role_type
  FROM notes n
  JOIN resources r ON r.resource_id = n.note_id
  JOIN collaborator_roles cr ON cr.resource_id = n.note_id
  WHERE n.note_id = 'uuid-here';
"

# Copy the output and send back to agent
```

**Why it's needed:**
- Verify data state
- Check constraint violations
- Debug foreign key issues
- Confirm transactions succeeded

**What to tell the agent after:**
> "Query executed. Results: [paste query output]. [Interpretation: what it means]."

Example:
> "Query executed. Results show 0 rows. The resource was not created, confirming transaction rolled back."

---

## 5. Deployment Tasks

### Task 5.1: Deploy to Vercel

**What agents CANNOT do:** Deploy to Vercel

**What YOU need to do:**

**First time setup:**
1. Push code to GitHub
2. Go to https://vercel.com
3. Click "Import Project"
4. Select your BookWorm repository
5. Configure environment variables:
   - Add `DATABASE_URL` from .env.local
6. Click "Deploy"

**Subsequent deploys:**
```bash
# Just push to GitHub
git push origin main
# Vercel auto-deploys
```

**Why it's needed:**
- Make app publicly accessible
- Test in production environment
- Share with professor/classmates

**How to verify:**
- Vercel shows "Deployment Ready"
- Visit your-project.vercel.app
- Test login with seed users
- Check database connection works

**What to tell the agent after:**
> ✅ "Deployed to Vercel at [URL]. Production build successful. Database connected."

---

### Task 5.2: Configure Custom Domain (Optional)

**What agents CANNOT do:** Configure DNS

**What YOU need to do:**
1. Buy domain (e.g., bookworm.yourdomain.com)
2. In Vercel dashboard → Settings → Domains
3. Add your domain
4. Configure DNS records (provided by Vercel)
5. Wait for DNS propagation (up to 24 hours)

**Why it's needed:**
- Professional URL for demo
- Better for university submission

**What to tell the agent after:**
> ✅ "Custom domain configured: bookworm.yourdomain.com. SSL certificate active."

---

## 6. Git & Version Control

### Task 6.1: Create GitHub Repository

**What agents CANNOT do:** Create remote repos

**What YOU need to do:**
```bash
# If not done already:
# 1. Go to https://github.com/new
# 2. Create repository "bookworm"
# 3. Don't initialize with README

# Then locally:
cd /home/thepg/Projects/BookWorm/bookworm
git remote add origin https://github.com/YOUR-USERNAME/bookworm.git
git branch -M main
git push -u origin main
```

**Why it's needed:**
- Version control
- Collaboration
- Deployment integration
- Backup

**How to verify:**
```bash
git remote -v
# Should show origin pointing to GitHub

# Visit https://github.com/YOUR-USERNAME/bookworm
# Should see your code
```

**What to tell the agent after:**
> ✅ "GitHub repository created and pushed. Remote URL: [URL]."

---

### Task 6.2: Create Feature Branch

**What agents CAN do:** Suggest branch name  
**What YOU need to do:** Create and switch

**Steps:**
```bash
# Agent suggests: "Create branch feature/database-connection"
git checkout -b feature/database-connection

# Make changes...

# Push branch
git push origin feature/database-connection
```

**Why it's needed:**
- Isolate features
- Create pull requests
- Review before merging

**What to tell the agent after:**
> ✅ "Branch 'feature/database-connection' created and pushed. Ready for development."

---

### Task 6.3: Create Pull Request

**What agents CANNOT do:** Use GitHub UI

**What YOU need to do:**
1. Push feature branch
2. Go to GitHub repository
3. Click "Compare & pull request"
4. Fill in description
5. Create PR

**Why it's needed:**
- Code review
- Document changes
- Track progress

**What to tell the agent after:**
> ✅ "PR created: #[number] - [title]. Link: [URL]."

---

## 7. External Service Configuration

### Task 7.1: Neon Database Branch (Optional)

**What agents CANNOT do:** Create Neon branches

**What YOU need to do:**
1. Open https://console.neon.tech
2. Go to your project
3. Click "Branches" → "New Branch"
4. Name it (e.g., "preview-pr-123")
5. Copy the new connection string
6. Use for PR previews

**Why it's needed:**
- Test database changes safely
- Isolated environments per PR
- Don't pollute main database

**What to tell the agent after:**
> ✅ "Neon branch 'preview-pr-123' created. Connection string: [URL]."

---

### Task 7.2: Set Up GitHub Actions (Optional)

**What agents CAN do:** Provide workflow YAML  
**What YOU need to do:** Create the file and enable

**Steps:**
```bash
# Agent provides .github/workflows/test.yml
# You create it:
mkdir -p .github/workflows
cat > .github/workflows/test.yml << 'EOF'
# [Agent-provided content]
EOF

git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions workflow"
git push
```

**Why it's needed:**
- Automated testing
- CI/CD pipeline
- Type checking on PRs

**How to verify:**
- Go to GitHub → Actions tab
- Should see workflow runs

**What to tell the agent after:**
> ✅ "GitHub Actions enabled. Workflow running on push. Last run: [status]."

---

## 8. Communication Protocol

### When Agent Needs You to Do Something

**Agent will say:**
```markdown
🚨 **HUMAN ACTION REQUIRED**

**Task:** [Task name from this document]
**Reason:** [Why it's needed]
**Steps:** [Numbered list]
**Verify with:** [Command or check]

⏸️ **I am paused until you complete this and report back.**
```

### What You Should Reply

**Template:**
```markdown
✅ **Task completed: [Task name]**

**What I did:**
- [Step 1]
- [Step 2]

**Verification results:**
```
[Output from verification command]
```

**Status:** Success / Partial / Failed

**Additional notes:** [Any issues or observations]
```

---

## 9. Emergency Procedures

### Emergency 1: Dev Server Won't Start

**Symptoms:**
- `npm run dev` fails
- Port 3000 already in use

**What to do:**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

**Tell agent:**
> "Dev server restarted on port 3001 due to port conflict."

---

### Emergency 2: Database Connection Failing

**Symptoms:**
- "ECONNREFUSED" errors
- "SSL connection failed"

**What to do:**
```bash
# Test connection directly
psql $DATABASE_URL -c "SELECT 1;"

# If fails, check:
# 1. Is .env.local correct?
cat .env.local | grep DATABASE_URL

# 2. Is Neon project active?
# Visit https://console.neon.tech

# 3. Is connection string correct?
# Re-copy from Neon dashboard
```

**Tell agent:**
> "Database connection issue. Error: [exact error]. Neon console shows [status]. Connection string verified."

---

### Emergency 3: Git Conflicts

**Symptoms:**
- "Merge conflict in [file]"
- Can't pull or push

**What to do:**
```bash
# View conflicts
git status

# Option 1: Accept incoming changes
git checkout --theirs [file]

# Option 2: Accept your changes  
git checkout --ours [file]

# Option 3: Merge manually
# Open file, edit between <<<<<<< and >>>>>>>

# Then:
git add [file]
git commit
```

**Tell agent:**
> "Git conflict in [file] resolved. Chose [theirs/ours/manual merge]. Reason: [explanation]."

---

### Emergency 4: Package Installation Fails

**Symptoms:**
- `npm install` errors
- Missing dependencies

**What to do:**
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm cache clean --force

# Reinstall
npm install

# If specific package fails:
npm install [package-name] --legacy-peer-deps
```

**Tell agent:**
> "npm install issues resolved. [Description of fix]. All packages installed."

---

## 10. Quick Reference

### Most Common Human Tasks (By Frequency)

**Every session:**
1. Start dev server: `npm run dev`
2. Open browser: http://localhost:3000
3. Test UI changes manually

**Per feature:**
1. Run SQL to verify: `psql $DATABASE_URL -c "..."`
2. Check browser console (F12)
3. Git commit: `git add . && git commit -m "..."`

**Occasionally:**
1. Install dependencies: `npm install`
2. Reset database: Re-run schema.sql + warm_up.sql
3. Deploy to Vercel: Push to GitHub

**Rarely:**
1. Initial setup: Create .env.local
2. Database migrations: Apply schema changes
3. CI/CD setup: Configure GitHub Actions

---

## 11. Agent Handoff Template

When you complete a human task and hand back to agent:

```markdown
## ✅ Human Task Completed

**Task:** [Task name]
**Date:** [Date & time]
**Duration:** [How long it took]

### Actions Taken:
1. [What you did]
2. [What you did]

### Results:
```
[Command outputs, screenshots, or observations]
```

### Current State:
- Dev server: [Running on port 3000 / Stopped]
- Database: [Connected / Schema version X / Seed data loaded]
- Git: [On branch X / Clean working tree]
- Browser: [Page X loaded / Error state]

### Agent Can Now:
- [What's unblocked]
- [What's ready to test]
- [What you're ready for next]

### Blockers Remaining:
- [Any issues still present]
- [Dependencies not met]

**Ready for agent to continue with:** [Specific next task]
```

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**For:** Coordinating human-agent workflows on BookWorm project

**Keep this document open while working with agents!**
