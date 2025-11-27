-- Auth-Agent MCP Database Schema
-- PostgreSQL schema for MCP server authorization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MCP SERVERS
-- ============================================================================

-- MCP Servers Registry
-- Stores registered MCP servers that use Auth-Agent for authorization
CREATE TABLE mcp_servers (
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

-- MCP Server API Keys (for token introspection)
-- MCP servers use these keys to validate tokens
CREATE TABLE mcp_server_keys (
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
-- OAUTH CLIENTS
-- ============================================================================

-- OAuth Clients (MCP clients like Claude Code, Cursor, etc.)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT UNIQUE NOT NULL,
    client_secret_hash TEXT,  -- NULL for public clients
    client_name TEXT NOT NULL,
    client_type TEXT DEFAULT 'mcp_client',  -- mcp_client, confidential
    redirect_uris TEXT[] NOT NULL,
    grant_types TEXT[] DEFAULT '{authorization_code,refresh_token}',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT client_id_format CHECK (client_id ~ '^client_[a-zA-Z0-9_-]+$')
);

-- ============================================================================
-- AUTHORIZATION FLOW
-- ============================================================================

-- Authorization Requests (temporary, during OAuth flow)
-- Stores state between /authorize and user consent
CREATE TABLE auth_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL REFERENCES clients(client_id),
    redirect_uri TEXT NOT NULL,
    state TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT DEFAULT 'S256',
    scope TEXT DEFAULT 'openid profile email',
    resource TEXT,  -- RFC 8707 - MCP server URL (audience)
    user_email TEXT,  -- Set after user authenticates
    authenticated BOOLEAN DEFAULT FALSE,
    authorization_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes'),

    CONSTRAINT code_challenge_method_check CHECK (code_challenge_method = 'S256')
);

-- Authorization Codes (short-lived, single-use)
CREATE TABLE auth_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL REFERENCES clients(client_id),
    user_email TEXT NOT NULL,
    resource TEXT NOT NULL,  -- RFC 8707 - MCP server URL (audience)
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    scope TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),

    CONSTRAINT code_format CHECK (code ~ '^ac_[a-zA-Z0-9]+$')
);

-- ============================================================================
-- TOKENS
-- ============================================================================

-- Access and Refresh Tokens
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,   -- JWT
    refresh_token TEXT NOT NULL,  -- Opaque
    client_id TEXT NOT NULL REFERENCES clients(client_id),
    user_email TEXT NOT NULL,
    resource TEXT NOT NULL,  -- RFC 8707 - MCP server URL (audience)
    scope TEXT NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT token_id_format CHECK (token_id ~ '^tok_[a-zA-Z0-9]+$')
);

-- ============================================================================
-- USER AUTHORIZATIONS
-- ============================================================================

-- Track which users authorized which MCP servers
-- Used for showing "previously authorized" in consent UI
CREATE TABLE user_authorizations (
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
-- INDEXES
-- ============================================================================

-- MCP Servers
CREATE INDEX idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX idx_mcp_servers_server_url ON mcp_servers(server_url);

-- Server Keys
CREATE INDEX idx_mcp_server_keys_server_id ON mcp_server_keys(server_id);
CREATE INDEX idx_mcp_server_keys_expires_at ON mcp_server_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Clients
CREATE INDEX idx_clients_client_type ON clients(client_type);

-- Auth Requests
CREATE INDEX idx_auth_requests_expires_at ON auth_requests(expires_at);
CREATE INDEX idx_auth_requests_request_id ON auth_requests(request_id);

-- Auth Codes
CREATE INDEX idx_auth_codes_code ON auth_codes(code);
CREATE INDEX idx_auth_codes_expires_at ON auth_codes(expires_at);
CREATE INDEX idx_auth_codes_used ON auth_codes(used) WHERE used = FALSE;

-- Tokens
CREATE INDEX idx_tokens_client_id ON tokens(client_id);
CREATE INDEX idx_tokens_user_email ON tokens(user_email);
CREATE INDEX idx_tokens_resource ON tokens(resource) WHERE revoked = FALSE;
CREATE INDEX idx_tokens_refresh_token ON tokens(refresh_token) WHERE revoked = FALSE;
CREATE INDEX idx_tokens_revoked ON tokens(revoked) WHERE revoked = FALSE;

-- User Authorizations
CREATE INDEX idx_user_authorizations_user_email ON user_authorizations(user_email);
CREATE INDEX idx_user_authorizations_server_client ON user_authorizations(server_id, client_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_server_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_authorizations ENABLE ROW LEVEL SECURITY;

-- Service role (Cloudflare Worker) has full access
CREATE POLICY "Service role full access to mcp_servers"
    ON mcp_servers FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to mcp_server_keys"
    ON mcp_server_keys FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to clients"
    ON clients FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to auth_requests"
    ON auth_requests FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to auth_codes"
    ON auth_codes FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to tokens"
    ON tokens FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to user_authorizations"
    ON user_authorizations FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to clean up expired auth requests
CREATE OR REPLACE FUNCTION cleanup_expired_auth_requests()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_requests WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired auth codes
CREATE OR REPLACE FUNCTION cleanup_expired_auth_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (for development)
-- ============================================================================

-- Example MCP Client (public client, no secret)
INSERT INTO clients (client_id, client_secret_hash, client_name, client_type, redirect_uris, grant_types)
VALUES (
    'client_claude_code',
    NULL,  -- Public client
    'Claude Code',
    'mcp_client',
    ARRAY['http://localhost:3000/callback', 'http://127.0.0.1:3000/callback'],
    ARRAY['authorization_code', 'refresh_token']
) ON CONFLICT (client_id) DO NOTHING;

-- Example MCP Client (install-mcp)
INSERT INTO clients (client_id, client_secret_hash, client_name, client_type, redirect_uris, grant_types)
VALUES (
    'client_install_mcp',
    NULL,  -- Public client
    'install-mcp CLI',
    'mcp_client',
    ARRAY['http://localhost:8080/callback', 'http://127.0.0.1:8080/callback'],
    ARRAY['authorization_code', 'refresh_token']
) ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mcp_servers IS 'Registry of MCP servers using Auth-Agent for authorization';
COMMENT ON TABLE mcp_server_keys IS 'API keys for MCP servers to validate tokens via introspection';
COMMENT ON TABLE clients IS 'OAuth clients (MCP clients like Claude Code, Cursor, etc.)';
COMMENT ON TABLE auth_requests IS 'Temporary storage during OAuth authorization flow';
COMMENT ON TABLE auth_codes IS 'Short-lived authorization codes (single-use)';
COMMENT ON TABLE tokens IS 'Access and refresh tokens';
COMMENT ON TABLE user_authorizations IS 'Track user consent for MCP server access';

COMMENT ON COLUMN tokens.resource IS 'RFC 8707 - Audience claim (MCP server URL)';
COMMENT ON COLUMN auth_codes.resource IS 'RFC 8707 - Intended MCP server for this token';
COMMENT ON COLUMN mcp_server_keys.key_hash IS 'PBKDF2 hashed API key with 100k iterations';
