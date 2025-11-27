import type { Context, Next } from 'hono';
import type { AuthAgentConfig, AuthUser } from './types.js';
import { AuthAgentClient } from './client.js';
import { AuthenticationError, AuthorizationError } from './types.js';

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Hono middleware for Auth-Agent MCP
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { authAgentMiddleware } from '@auth-agent/mcp-sdk';
 *
 * const app = new Hono();
 *
 * app.use('*', authAgentMiddleware({
 *   serverId: 'srv_abc123',
 *   apiKey: 'sk_xyz789',
 *   requiredScopes: ['files:read']
 * }));
 *
 * app.get('/files', (c) => {
 *   const user = c.get('user');
 *   return c.json({ user });
 * });
 * ```
 */
export function authAgentMiddleware(config: AuthAgentConfig) {
  const client = new AuthAgentClient(config);

  return async (c: Context, next: Next) => {
    try {
      // Extract token from Authorization header
      const authHeader = c.req.header('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return c.json(
          {
            error: 'unauthorized',
            error_description: 'Missing or invalid Authorization header',
          },
          401,
          {
            'WWW-Authenticate': 'Bearer realm="MCP Server"',
          }
        );
      }

      // Validate token
      const user = await client.validateToken(token);

      // Check scopes
      if (!client.hasRequiredScopes(user)) {
        return c.json(
          {
            error: 'insufficient_scope',
            error_description: `Required scopes: ${config.requiredScopes?.join(', ')}`,
            required_scopes: config.requiredScopes,
          },
          403
        );
      }

      // Attach user to context
      c.set('user', user);

      await next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return c.json(
          {
            error: error.code || 'invalid_token',
            error_description: error.message,
          },
          401,
          {
            'WWW-Authenticate': 'Bearer realm="MCP Server", error="invalid_token"',
          }
        );
      }

      if (error instanceof AuthorizationError) {
        return c.json(
          {
            error: 'insufficient_scope',
            error_description: error.message,
            required_scopes: error.requiredScopes,
          },
          403
        );
      }

      // Unknown error
      console.error('Auth-Agent middleware error:', error);
      return c.json(
        {
          error: 'server_error',
          error_description: 'Authentication failed',
        },
        500
      );
    }
  };
}

/**
 * Extend Hono context with user type
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}
