/**
 * Auth-Agent MCP - OAuth 2.1 Authorization Server for MCP Servers
 *
 * Main entry point for the Cloudflare Worker
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { oauth } from './routes/oauth';
import { discovery } from './routes/discovery';
import { servers } from './routes/servers';
import { introspection } from './routes/introspection';

export interface Env {
  ENVIRONMENT: string;
  ISSUER_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware - allow all origins for OAuth
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['WWW-Authenticate'],
  maxAge: 86400,
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'auth-agent-mcp',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
  });
});

// Discovery endpoints (RFC 9728, RFC 8414)
app.route('/.well-known', discovery);

// OAuth endpoints (/authorize, /token, /userinfo)
app.route('/', oauth);

// Token introspection and revocation
app.route('/', introspection);

// MCP server management API
app.route('/api/servers', servers);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({
    error: 'Internal server error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : undefined
  }, 500);
});

export default app;
