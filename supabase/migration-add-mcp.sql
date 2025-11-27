-- Migration: Add MCP Support to Existing Auth-Agent Database
-- This adds MCP-specific tables and columns to existing schema

-- ============================================================================
-- ADD MCP-SPECIFIC COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add resource column to existing tables (for RFC 8707 audience)
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS resource TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS resource TEXT;
ALTER TABLE auth_requests ADD COLUMN IF NOT EXISTS resource TEXT;

-- Add user_email to tokens if it doesn't exist (for email-based MCP OAuth)
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Make agent_id nullable in tokens for MCP OAuth (MCP uses user_email, not agent_id)
-- Main Auth-Agent always provides agent_id, so this won't break it
ALTER TABLE tokens ALTER COLUMN agent_id DROP NOT NULL;

-- Make model nullable in tokens for MCP OAuth (MCP doesn't use model field)
-- Main Auth-Agent always provides model, so this won't break it
ALTER TABLE tokens ALTER COLUMN model DROP NOT NULL;

-- Add user_email to auth_codes if it doesn't exist (for email-based MCP OAuth)
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Make agent_id nullable for MCP OAuth (MCP uses user_email, not agent_id)
-- Main Auth-Agent always provides agent_id, so this won't break it
ALTER TABLE auth_codes ALTER COLUMN agent_id DROP NOT NULL;

-- Make model nullable for MCP OAuth (MCP doesn't use model field)
-- Main Auth-Agent always provides model, so this won't break it
ALTER TABLE auth_codes ALTER COLUMN model DROP NOT NULL;

-- Add client_type to existing clients table if not exists
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'website';

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tokens_resource ON tokens(resource) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_auth_codes_resource ON auth_codes(resource);

-- ============================================================================
-- MCP SERVERS (NEW TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT UNIQUE NOT NULL,
    server_url TEXT UNIQUE NOT NULL,
    server_name TEXT NOT NULL,
    description TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    logo_url TEXT,
    user_id UUID NOT NULL,  -- Owner of this MCP server
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT server_id_format CHECK (server_id ~ '^srv_[a-zA-Z0-9]+$'),
    CONSTRAINT server_url_format CHECK (server_url ~ '^https?://')
);

-- ============================================================================
-- MCP SERVER API KEYS (NEW TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_server_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id TEXT UNIQUE NOT NULL,
    key_hash TEXT NOT NULL,  -- PBKDF2 hashed
    server_id TEXT NOT NULL REFERENCES mcp_servers(server_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    CONSTRAINT key_id_format CHECK (key_id ~ '^sk_[a-zA-Z0-9]+$')
);

-- ============================================================================
-- USER AUTHORIZATIONS (NEW TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_authorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_email TEXT NOT NULL,
    server_id TEXT NOT NULL REFERENCES mcp_servers(server_id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES clients(client_id),
    granted_scopes TEXT[] NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    UNIQUE(user_email, server_id, client_id)
);

-- ============================================================================
-- INDEXES FOR NEW TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_server_url ON mcp_servers(server_url);

CREATE INDEX IF NOT EXISTS idx_mcp_server_keys_server_id ON mcp_server_keys(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_keys_expires_at ON mcp_server_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_authorizations_user_email ON user_authorizations(user_email);
CREATE INDEX IF NOT EXISTS idx_user_authorizations_server_client ON user_authorizations(server_id, client_id);

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_server_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_authorizations ENABLE ROW LEVEL SECURITY;

-- Service role (Cloudflare Worker) has full access
DROP POLICY IF EXISTS "Service role full access to mcp_servers" ON mcp_servers;
CREATE POLICY "Service role full access to mcp_servers"
    ON mcp_servers FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to mcp_server_keys" ON mcp_server_keys;
CREATE POLICY "Service role full access to mcp_server_keys"
    ON mcp_server_keys FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to user_authorizations" ON user_authorizations;
CREATE POLICY "Service role full access to user_authorizations"
    ON user_authorizations FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- TRIGGERS FOR NEW TABLES
-- ============================================================================

-- Create trigger for mcp_servers.updated_at
DROP TRIGGER IF EXISTS update_mcp_servers_updated_at ON mcp_servers;
CREATE TRIGGER update_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT MCP-SPECIFIC OAUTH CLIENTS (if not exists)
-- ============================================================================

-- Note: Using 'public_client' as client_secret_hash since column is NOT NULL in existing schema
-- MCP clients are public clients and don't actually use the secret

-- Claude Code client
INSERT INTO clients (client_id, client_secret_hash, client_name, client_type, allowed_redirect_uris)
VALUES (
    'client_claude_code',
    'public_client',  -- Dummy value since NOT NULL
    'Claude Code',
    'mcp_client',
    ARRAY['http://localhost:3000/callback', 'http://127.0.0.1:3000/callback']
) ON CONFLICT (client_id) DO NOTHING;

-- install-mcp client
INSERT INTO clients (client_id, client_secret_hash, client_name, client_type, allowed_redirect_uris)
VALUES (
    'client_install_mcp',
    'public_client',  -- Dummy value since NOT NULL
    'install-mcp CLI',
    'mcp_client',
    ARRAY['http://localhost:8080/callback', 'http://127.0.0.1:8080/callback']
) ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mcp_servers IS 'Registry of MCP servers using Auth-Agent for authorization';
COMMENT ON TABLE mcp_server_keys IS 'API keys for MCP servers to validate tokens via introspection';
COMMENT ON TABLE user_authorizations IS 'Track user consent for MCP server access';

COMMENT ON COLUMN tokens.resource IS 'RFC 8707 - Audience claim (MCP server URL)';
COMMENT ON COLUMN auth_codes.resource IS 'RFC 8707 - Intended MCP server for this token';
COMMENT ON COLUMN mcp_server_keys.key_hash IS 'PBKDF2 hashed API key with 100k iterations';
COMMENT ON COLUMN clients.client_type IS 'website (for web agents) or mcp_client (for MCP clients)';
