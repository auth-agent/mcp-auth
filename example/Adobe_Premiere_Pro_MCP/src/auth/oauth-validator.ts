/**
 * OAuth 2.1 Token Validator for MCP Adobe Premiere Pro Server
 *
 * This module validates OAuth tokens using Auth-Agent MCP
 * for authenticated MCP server operations.
 */

import { AuthAgentClient, AuthUser } from 'auth-agent-mcp-sdk';
import { Logger } from '../utils/logger.js';

export interface OAuthConfig {
  serverId: string;
  apiKey: string;
  requiredScopes?: string[];
  authServerUrl?: string;
}

export class OAuthValidator {
  private client: AuthAgentClient;
  private logger: Logger;
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
    this.logger = new Logger('OAuthValidator');

    this.client = new AuthAgentClient({
      serverId: config.serverId,
      apiKey: config.apiKey,
      requiredScopes: config.requiredScopes || [],
      authServerUrl: config.authServerUrl || 'https://mcp.auth-agent.com',
    });

    this.logger.info('OAuth validator initialized for server:', config.serverId);
  }

  /**
   * Validate an access token and return user information
   */
  async validateToken(token: string): Promise<AuthUser> {
    try {
      const user = await this.client.validateToken(token);

      // Check required scopes
      if (!this.client.hasRequiredScopes(user)) {
        throw new Error(
          `Insufficient scopes. Required: ${this.config.requiredScopes?.join(', ')}, ` +
          `Got: ${user.scopes.join(', ')}`
        );
      }

      this.logger.info(`Token validated for user: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      throw new Error(
        `OAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if OAuth is enabled
   */
  isEnabled(): boolean {
    return Boolean(this.config.serverId && this.config.apiKey);
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.client.clearCache();
    this.logger.info('Token cache cleared');
  }
}
