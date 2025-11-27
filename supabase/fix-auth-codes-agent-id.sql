-- Fix: Make agent_id and model nullable in auth_codes for MCP OAuth flow
-- MCP OAuth uses user_email and resource, not agent_id and model
-- Main Auth-Agent always provides agent_id and model, so making them nullable won't break it

-- Make agent_id nullable (main Auth-Agent always provides it)
ALTER TABLE auth_codes ALTER COLUMN agent_id DROP NOT NULL;

-- Make model nullable (main Auth-Agent always provides it)
ALTER TABLE auth_codes ALTER COLUMN model DROP NOT NULL;

-- Add user_email column if it doesn't exist
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add resource column if it doesn't exist
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS resource TEXT;

