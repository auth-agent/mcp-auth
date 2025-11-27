import type { AuthAgentConfig, IntrospectionResponse, AuthUser } from './types.js';
import { AuthenticationError } from './types.js';

/**
 * Simple in-memory cache for introspection results
 */
class TokenCache {
  private cache = new Map<string, { user: AuthUser; expiresAt: number }>();

  get(token: string): AuthUser | null {
    const cached = this.cache.get(token);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(token);
      return null;
    }

    return cached.user;
  }

  set(token: string, user: AuthUser, ttlSeconds: number): void {
    this.cache.set(token, {
      user,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Auth-Agent MCP client for token validation
 */
export class AuthAgentClient {
  private config: Required<AuthAgentConfig>;
  private cache: TokenCache;

  constructor(config: AuthAgentConfig) {
    this.config = {
      serverId: config.serverId,
      apiKey: config.apiKey,
      requiredScopes: config.requiredScopes || [],
      authServerUrl: config.authServerUrl || 'https://mcp.auth-agent.com',
      cacheTtl: config.cacheTtl || 300,
    };
    this.cache = new TokenCache();
  }

  /**
   * Validate an access token and return user information
   */
  async validateToken(token: string): Promise<AuthUser> {
    // Check cache first
    const cached = this.cache.get(token);
    if (cached) {
      return cached;
    }

    // Introspect token
    const response = await fetch(`${this.config.authServerUrl}/introspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        token,
        token_type_hint: 'access_token',
      }),
    });

    if (!response.ok) {
      throw new AuthenticationError(
        `Token introspection failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json() as IntrospectionResponse;

    if (!data.active) {
      throw new AuthenticationError('Token is not active', 401, 'invalid_token');
    }

    // Parse user info
    const user: AuthUser = {
      email: data.sub || '',
      clientId: data.client_id || '',
      scopes: data.scope ? data.scope.split(' ') : [],
      resource: data.aud || '',
    };

    // Cache the result
    if (data.exp) {
      const ttl = Math.min(
        data.exp - Math.floor(Date.now() / 1000),
        this.config.cacheTtl
      );
      if (ttl > 0) {
        this.cache.set(token, user, ttl);
      }
    } else {
      this.cache.set(token, user, this.config.cacheTtl);
    }

    return user;
  }

  /**
   * Check if user has required scopes
   */
  hasRequiredScopes(user: AuthUser): boolean {
    if (this.config.requiredScopes.length === 0) {
      return true;
    }

    return this.config.requiredScopes.every(scope =>
      user.scopes.includes(scope)
    );
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
