/**
 * Configuration for Auth-Agent MCP middleware
 */
export interface AuthAgentConfig {
  /**
   * Your MCP server ID from Auth-Agent (e.g., srv_abc123)
   */
  serverId: string;

  /**
   * Your API key for token introspection (e.g., sk_xyz789)
   */
  apiKey: string;

  /**
   * Required scopes for this endpoint (e.g., ['files:read', 'files:write'])
   */
  requiredScopes?: string[];

  /**
   * Auth-Agent MCP server URL
   * @default 'https://mcp.auth-agent.com'
   */
  authServerUrl?: string;

  /**
   * Cache introspection results for this many seconds
   * @default 300 (5 minutes)
   */
  cacheTtl?: number;
}

/**
 * Token introspection response from Auth-Agent
 */
export interface IntrospectionResponse {
  active: boolean;
  sub?: string;
  client_id?: string;
  scope?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

/**
 * User information extracted from validated token
 */
export interface AuthUser {
  email: string;
  clientId: string;
  scopes: string[];
  resource: string;
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when authorization (scope check) fails
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public requiredScopes?: string[]
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
