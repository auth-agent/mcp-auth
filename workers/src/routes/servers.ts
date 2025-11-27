/**
 * MCP Server Management API
 * - Register MCP servers
 * - Manage server keys
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { Database } from '../lib/db';
import { hashSecret, generateId } from '../lib/crypto';
import { isValidUrl } from '../lib/validation';

const app = new Hono<{ Bindings: Env }>();

// TODO: Add authentication middleware to verify user
// For now, accepting userId in request body (insecure, just for demo)

// ============================================================================
// REGISTER MCP SERVER
// ============================================================================

app.post('/', async (c) => {
  const {
    server_url,
    server_name,
    description,
    scopes,
    logo_url,
    user_id,  // TODO: Get from authenticated user session
  } = await c.req.json();

  // Validate inputs
  if (!server_url || !server_name || !scopes || !user_id) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Missing required fields'
    }, 400);
  }

  if (!isValidUrl(server_url)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid server_url'
    }, 400);
  }

  if (!Array.isArray(scopes) || scopes.length === 0) {
    return c.json({
      error: 'invalid_request',
      error_description: 'scopes must be a non-empty array'
    }, 400);
  }

  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_KEY || 
      c.env.SUPABASE_URL.trim() === '' || c.env.SUPABASE_SERVICE_KEY.trim() === '') {
    return c.json({
      error: 'configuration_error',
      error_description: `Supabase credentials not configured. URL: ${c.env.SUPABASE_URL ? 'set' : 'missing'}, Key: ${c.env.SUPABASE_SERVICE_KEY ? 'set' : 'missing'}`
    }, 500);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const server = await db.createMcpServer({
      server_url,
      server_name,
      description,
      scopes,
      logo_url,
      user_id,
    });

    return c.json({
      server_id: server.server_id,
      server_url: server.server_url,
      server_name: server.server_name,
      scopes: server.scopes,
      created_at: server.created_at,
    }, 201);
  } catch (error: any) {
    console.error('Server creation error:', error);
    return c.json({
      error: 'server_creation_failed',
      error_description: error.message || 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// GENERATE API KEY FOR MCP SERVER
// ============================================================================

app.post('/:server_id/keys', async (c) => {
  const serverId = c.req.param('server_id');
  const { name, expires_in } = await c.req.json();

  if (!name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  // Verify server exists
  const server = await db.getMcpServer(serverId);
  if (!server) {
    return c.json({ error: 'Server not found' }, 404);
  }

  // Generate API key
  const keySecret = generateId('sk', 32);
  const keyHash = await hashSecret(keySecret);

  const expiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : undefined;

  try {
    const key = await db.createServerKey({
      server_id: serverId,
      key_hash: keyHash,
      name,
      expires_at: expiresAt,
    });

    return c.json({
      key_id: key.key_id,
      key_secret: keySecret,  // Only shown once!
      name: key.name,
      created_at: key.created_at,
      expires_at: key.expires_at,
    }, 201);
  } catch (error: any) {
    return c.json({
      error: 'key_creation_failed',
      error_description: error.message
    }, 500);
  }
});

export { app as servers };
