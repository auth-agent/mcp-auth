/**
 * Token introspection and revocation endpoints
 * - RFC 7662: Token Introspection
 * - RFC 7009: Token Revocation
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { Database } from '../lib/db';
import { verifyJWT, verifySecret } from '../lib/crypto';

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// TOKEN INTROSPECTION (RFC 7662)
// ============================================================================

app.post('/introspect', async (c) => {
  // Authenticate the caller (MCP server with API key)
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'invalid_client', error_description: 'Missing API key' }, 401);
  }

  const apiKey = authHeader.substring(7);
  const { token } = await c.req.json();

  if (!token) {
    return c.json({ active: false });
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  // Validate API key - MUST be a valid server key
  const serverKey = await db.getServerKeyBySecret(apiKey);
  if (!serverKey) {
    return c.json({ error: 'invalid_client', error_description: 'Invalid API key' }, 401);
  }

  // Update last_used_at for the key
  await db.updateServerKeyLastUsed(serverKey.key_id);

  // Verify JWT
  const decoded = await verifyJWT(token, c.env.JWT_SECRET);
  if (!decoded) {
    return c.json({ active: false });
  }

  // Check if token is revoked in database
  const tokenRecord = await db.getTokenByAccessToken(token);

  if (!tokenRecord || tokenRecord.revoked) {
    return c.json({ active: false });
  }

  // Check expiration
  if (tokenRecord.access_token_expires_at < new Date()) {
    return c.json({ active: false });
  }

  // Optionally: Check if token audience matches the server making the request
  // This ensures servers can only introspect tokens meant for them
  // const server = await db.getMcpServer(serverKey.server_id);
  // if (server && decoded.aud !== server.server_url) {
  //   return c.json({ active: false });  // Token not for this server
  // }

  // Return token info
  return c.json({
    active: true,
    sub: decoded.sub,
    client_id: decoded.client_id,
    scope: decoded.scope,
    aud: decoded.aud,  // RFC 8707 audience
    exp: decoded.exp,
    iat: decoded.iat,
  });
});

// ============================================================================
// TOKEN REVOCATION (RFC 7009)
// ============================================================================

app.post('/revoke', async (c) => {
  const { token, client_id, client_secret } = await c.req.json();

  // Per RFC 7009, always return 200 even if token is invalid
  if (!token || !client_id) {
    return c.text('OK', 200);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  // Validate client
  const client = await db.getClient(client_id);
  if (!client) {
    return c.text('OK', 200);
  }

  // Verify client_secret if provided
  if (client_secret && client.client_secret_hash) {
    const valid = await verifySecret(client_secret, client.client_secret_hash);
    if (!valid) {
      return c.text('OK', 200);
    }
  }

  // Revoke the token
  await db.revokeToken(token);

  return c.text('OK', 200);
});

export { app as introspection };
