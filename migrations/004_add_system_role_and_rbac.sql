-- Migration: 004_add_system_role_and_rbac.sql
-- Description: Add system_role column for system-wide role separation (ADMIN vs USER) alongside resource-level RBAC (OWNER, MAINTAINER, CONTRIBUTOR)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS system_role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (system_role IN ('ADMIN', 'USER'));

-- Set default administrator
UPDATE users SET system_role = 'ADMIN' WHERE username = 'alice';

COMMENT ON COLUMN users.system_role IS 'System-wide role: ADMIN (system administrative powers) or USER (standard collaborative user)';
