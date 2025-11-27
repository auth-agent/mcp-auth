/**
 * Discovery endpoints for Auth-Agent MCP
 * - RFC 8414: OAuth Authorization Server Metadata
 * - RFC 9728: Protected Resource Metadata
 * - OpenID Connect Discovery (optional)
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { Database } from '../lib/db';

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// RFC 8414 - OAuth Authorization Server Metadata
// ============================================================================

app.get('/oauth-authorization-server', (c) => {
  const issuer = c.env.ISSUER_URL;

  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    introspection_endpoint: `${issuer}/introspect`,
    revocation_endpoint: `${issuer}/revoke`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,

    // Supported features
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    introspection_endpoint_auth_methods_supported: ['client_secret_post'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['openid', 'profile', 'email'],

    // MCP-specific
    resource_indicators_supported: true,  // RFC 8707

    // Additional metadata
    service_documentation: 'https://docs.mcp.auth-agent.com',
    ui_locales_supported: ['en'],
  });
});

// ============================================================================
// RFC 9728 - Protected Resource Metadata
// ============================================================================

app.get('/oauth-protected-resource/:server_id?', async (c) => {
  const serverId = c.req.param('server_id');
  const issuer = c.env.ISSUER_URL;

  if (serverId) {
    // Server-specific metadata
    const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const server = await db.getMcpServer(serverId);

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    return c.json({
      resource: server.server_url,
      authorization_servers: [issuer],
      scopes_supported: server.scopes,
      bearer_methods_supported: ['header'],
      resource_signing_alg_values_supported: ['HS256'],
      resource_documentation: `${issuer}/docs/servers/${serverId}`,
    });
  } else {
    // Global metadata (for Auth-Agent itself as a resource)
    return c.json({
      resource: issuer,
      authorization_servers: [issuer],
      scopes_supported: ['openid', 'profile', 'email'],
      bearer_methods_supported: ['header'],
      resource_signing_alg_values_supported: ['HS256'],
      resource_documentation: 'https://docs.mcp.auth-agent.com',
    });
  }
});

// ============================================================================
// OpenID Connect Discovery (optional, for compatibility)
// ============================================================================

app.get('/openid-configuration', (c) => {
  const issuer = c.env.ISSUER_URL;

  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,

    // OpenID-specific
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],

    // OAuth
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['openid', 'profile', 'email'],

    // Claims
    claims_supported: ['sub', 'email', 'name'],

    // MCP-specific
    resource_indicators_supported: true,
  });
});

// ============================================================================
// JWKS (JSON Web Key Set)
// ============================================================================

app.get('/jwks.json', (c) => {
  // TODO: Implement RSA key publication for RS256
  // For now, returning empty (using HS256 symmetric keys)
  return c.json({
    keys: []
  });
});

export { app as discovery };
