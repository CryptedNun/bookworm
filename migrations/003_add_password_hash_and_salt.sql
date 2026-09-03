-- Migration: 003_add_password_hash_and_salt.sql
-- Description: Add password_hash and salt columns to users table for salted cryptographic authentication

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS salt TEXT;

-- Verify columns
COMMENT ON COLUMN users.password_hash IS 'PBKDF2 SHA-512 hex-encoded hashed password';
COMMENT ON COLUMN users.salt IS '16-byte random hex-encoded cryptographic salt';
