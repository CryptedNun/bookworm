-- =====================================================================
-- BookWorm — Seed Data for Testing
-- Creates test users, notebooks, and sample data
-- Run AFTER schema.sql has been loaded
-- =====================================================================

-- Clear existing data (in case re-running)
TRUNCATE TABLE 
  access_requests,
  issue_contributors,
  issues,
  commit_manifests,
  commits,
  editions,
  branches,
  block_version_contents,
  logical_block_slots,
  content_blobs,
  notes,
  notebooks,
  collaborator_roles,
  resources,
  users
CASCADE;

-- =====================================================================
-- 1. CREATE TEST USERS
-- =====================================================================

INSERT INTO users (user_id, email, username, avatar_url, is_active, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@bookworm.dev', 'alice', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', TRUE, '2026-01-15 10:00:00'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@bookworm.dev', 'bob', 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&auto=format&fit=crop&q=80', TRUE, '2026-01-20 14:30:00'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@bookworm.dev', 'charlie', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', TRUE, '2026-02-01 09:15:00');

-- =====================================================================
-- 2. CREATE SAMPLE NOTEBOOKS
-- =====================================================================

-- Alice's first notebook
INSERT INTO resources (resource_id, resource_type) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'NOTEBOOK');

INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility, deleted_at) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'CS 101 Study Notes', 'Collaborative computer science fundamentals, algorithms, and data structures.', 'PUBLIC', NULL);

INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'OWNER', '550e8400-e29b-41d4-a716-446655440001');

-- Alice's second notebook
INSERT INTO resources (resource_id, resource_type) VALUES
  ('650e8400-e29b-41d4-a716-446655440002', 'NOTEBOOK');

INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility) VALUES
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Modern Web Architecture', 'Next.js App Router, Server Components, and Database Optimization guides.', 'PUBLIC');

INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'OWNER', '550e8400-e29b-41d4-a716-446655440001');

-- Bob's notebook
INSERT INTO resources (resource_id, resource_type) VALUES
  ('650e8400-e29b-41d4-a716-446655440003', 'NOTEBOOK');

INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility) VALUES
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Database Internals', 'PostgreSQL internals and optimization strategies.', 'PUBLIC');

INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440003', 'OWNER', '550e8400-e29b-41d4-a716-446655440002');

-- =====================================================================
-- 3. CREATE SAMPLE NOTES
-- =====================================================================

-- Note 1: B-Trees (in Alice's CS 101 notebook)
INSERT INTO resources (resource_id, resource_type) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'NOTE');

INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'B-Trees and AVL Self-Balancing Trees', 'PUBLIC', 0);

INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'OWNER', '550e8400-e29b-41d4-a716-446655440001');

-- Create main branch for Note 1
INSERT INTO branches (branch_id, note_id, branch_name, is_main) VALUES
  ('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'main', TRUE);

-- Create initial block slot for Note 1
INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '1|100000', 'HEADING');

-- Create content blob for Note 1 initial content
INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('# B-Trees and AVL Self-Balancing Trees', 'sha256'), 'hex'), '# B-Trees and AVL Self-Balancing Trees', 37);

-- Create block version for Note 1
INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash) VALUES
  ('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', encode(digest('# B-Trees and AVL Self-Balancing Trees', 'sha256'), 'hex'));

-- Create initial commit for Note 1
INSERT INTO commits (commit_id, branch_id, author_id, commit_message, commit_hash) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Initial commit', encode(digest('initial-commit-note-1', 'sha256'), 'hex'));

-- Create commit manifest for Note 1
INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001');

-- Create default edition for Note 1
INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by) VALUES
  ('c50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'v1.0 Draft', 'btrees-v1', 'b50e8400-e29b-41d4-a716-446655440001', TRUE, '550e8400-e29b-41d4-a716-446655440001');

-- Link default edition back to note
UPDATE notes SET default_edition_id = 'c50e8400-e29b-41d4-a716-446655440001' 
WHERE note_id = '750e8400-e29b-41d4-a716-446655440001';

-- Note 2: Graph Algorithms (in Alice's CS 101 notebook)
INSERT INTO resources (resource_id, resource_type) VALUES
  ('750e8400-e29b-41d4-a716-446655440002', 'NOTE');

INSERT INTO notes (note_id, notebook_id, title, visibility, display_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'Graph Algorithms & Dijkstra Shortest Path', 'PUBLIC', 1);

INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', 'OWNER', '550e8400-e29b-41d4-a716-446655440001');

-- Create main branch for Note 2
INSERT INTO branches (branch_id, note_id, branch_name, is_main) VALUES
  ('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'main', TRUE);

-- Create initial block slot for Note 2
INSERT INTO logical_block_slots (slot_id, note_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', '1|100000', 'HEADING');

-- Create content blob for Note 2
INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('# Graph Algorithms & Dijkstra Shortest Path', 'sha256'), 'hex'), '# Graph Algorithms & Dijkstra Shortest Path', 44);

-- Create block version for Note 2
INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash) VALUES
  ('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', encode(digest('# Graph Algorithms & Dijkstra Shortest Path', 'sha256'), 'hex'));

-- Create initial commit for Note 2
INSERT INTO commits (commit_id, branch_id, author_id, commit_message, commit_hash) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Initial commit', encode(digest('initial-commit-note-2', 'sha256'), 'hex'));

-- Create commit manifest for Note 2
INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002');

-- Create default edition for Note 2
INSERT INTO editions (edition_id, note_id, edition_name, share_code, pinned_commit_id, is_standard, created_by) VALUES
  ('c50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'v1.0 Stable', 'graphs-v1', 'b50e8400-e29b-41d4-a716-446655440002', TRUE, '550e8400-e29b-41d4-a716-446655440001');

-- Link default edition back to note
UPDATE notes SET default_edition_id = 'c50e8400-e29b-41d4-a716-446655440002' 
WHERE note_id = '750e8400-e29b-41d4-a716-446655440002';

-- =====================================================================
-- 4. ADD COLLABORATORS
-- =====================================================================

-- Bob as MAINTAINER on Alice's CS 101 notebook
INSERT INTO collaborator_roles (user_id, resource_id, role_type, capabilities, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'MAINTAINER', '{"can_create_issue": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb, '550e8400-e29b-41d4-a716-446655440001');

-- Charlie as CONTRIBUTOR on Alice's CS 101 notebook
INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'CONTRIBUTOR', '550e8400-e29b-41d4-a716-446655440001');

-- =====================================================================
-- VERIFICATION QUERIES (run these to confirm data)
-- =====================================================================

-- Check users
-- SELECT username, email FROM users ORDER BY created_at;

-- Check notebooks with note counts
-- SELECT 
--   nb.title,
--   nb.visibility,
--   u.username as owner,
--   COUNT(n.note_id) as notes_count
-- FROM notebooks nb
-- JOIN users u ON u.user_id = nb.owner_id
-- LEFT JOIN notes n ON n.notebook_id = nb.notebook_id AND n.deleted_at IS NULL
-- WHERE nb.deleted_at IS NULL
-- GROUP BY nb.notebook_id, u.username;

-- Check notes with their branches and commits
-- SELECT 
--   nt.title,
--   b.branch_name,
--   b.is_main,
--   COUNT(c.commit_id) as commits_count
-- FROM notes nt
-- JOIN branches b ON b.note_id = nt.note_id
-- LEFT JOIN commits c ON c.branch_id = b.branch_id
-- GROUP BY nt.note_id, b.branch_id;
