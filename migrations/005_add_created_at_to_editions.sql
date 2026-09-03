-- Migration: 005_add_created_at_to_editions.sql
-- Description: Add created_at timestamp column to editions table

ALTER TABLE editions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
