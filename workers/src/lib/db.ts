/**
 * Database operations for Auth-Agent MCP
 * Supabase PostgreSQL client
 */

import type {
  McpServer,
  McpServerKey,
  OAuthClient,
  AuthRequest,
  AuthCode,
  Token,
  UserAuthorization,
} from '../types';

export class Database {
  constructor(
    private supabaseUrl: string,
    private supabaseKey: string
  ) {}

  private async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
      body: JSON.stringify({ query: sql, params }),
    });

    if (!response.ok) {
      throw new Error(`Database query failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // ==========================================================================
  // MCP SERVERS
  // ==========================================================================

  async getMcpServer(serverId: string): Promise<McpServer | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/mcp_servers?server_id=eq.${serverId}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  async getMcpServerByUrl(serverUrl: string): Promise<McpServer | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/mcp_servers?server_url=eq.${encodeURIComponent(serverUrl)}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  async createMcpServer(params: {
    server_url: string;
    server_name: string;
    description?: string;
    scopes: string[];
    logo_url?: string;
    user_id: string;
  }): Promise<McpServer> {
    const serverId = `srv_${this.generateRandomString(16)}`;

    if (!this.supabaseUrl) {
      throw new Error('Supabase URL is not configured');
    }

    const url = `${this.supabaseUrl}/rest/v1/mcp_servers`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        server_id: serverId,
        ...params,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    if (!data || !data[0]) {
      throw new Error('No data returned from Supabase');
    }
    return data[0];
  }

  // ==========================================================================
  // SERVER KEYS
  // ==========================================================================

  async getServerKeyBySecret(keySecret: string): Promise<McpServerKey | null> {
    // This would require checking the key_hash, implementation depends on your needs
    // For now, simplified version
    return null;
  }

  async createServerKey(params: {
    server_id: string;
    key_hash: string;
    name: string;
    expires_at?: Date;
  }): Promise<McpServerKey> {
    const keyId = `sk_${this.generateRandomString(16)}`;

    const response = await fetch(`${this.supabaseUrl}/rest/v1/mcp_server_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        key_id: keyId,
        ...params,
      }),
    });

    const data = await response.json();
    return data[0];
  }

  // ==========================================================================
  // OAUTH CLIENTS
  // ==========================================================================

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/clients?client_id=eq.${clientId}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  // ==========================================================================
  // AUTH REQUESTS
  // ==========================================================================

  async createAuthRequest(params: {
    client_id: string;
    redirect_uri: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
    scope: string;
    resource?: string;
  }): Promise<string> {
    const requestId = `req_${this.generateRandomString(16)}`;

    await fetch(`${this.supabaseUrl}/rest/v1/auth_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
      body: JSON.stringify({
        request_id: requestId,
        ...params,
      }),
    });

    return requestId;
  }

  async getAuthRequest(requestId: string): Promise<AuthRequest | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/auth_requests?request_id=eq.${requestId}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  async updateAuthRequest(requestId: string, updates: Partial<AuthRequest>): Promise<void> {
    await fetch(
      `${this.supabaseUrl}/rest/v1/auth_requests?request_id=eq.${requestId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify(updates),
      }
    );
  }

  // ==========================================================================
  // AUTH CODES
  // ==========================================================================

  async createAuthCode(params: {
    client_id: string;
    user_email: string;
    resource: string;
    redirect_uri: string;
    code_challenge: string;
    scope: string;
  }): Promise<string> {
    const code = `ac_${this.generateRandomString(32)}`;

    const payload = {
      code,
      client_id: params.client_id,
      user_email: params.user_email,
      resource: params.resource || '', // Ensure not null
      redirect_uri: params.redirect_uri,
      code_challenge: params.code_challenge,
      scope: params.scope,
      // MCP OAuth doesn't use agent_id or model (these are nullable for MCP)
      agent_id: null,
      model: null,
    };

    console.log('createAuthCode payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${this.supabaseUrl}/rest/v1/auth_codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('createAuthCode error:', response.status, errorData);
      console.error('Payload that failed:', payload);
      throw new Error(`Failed to create auth code: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Created auth code:', code, 'Response:', data);
    return code;
  }

  async getAuthCode(code: string): Promise<AuthCode | null> {
    // PostgREST filter syntax: code=eq.value
    // For text values, PostgREST handles the type automatically
    // Encode the code value to handle any special characters
    const encodedValue = encodeURIComponent(code);
    const url = `${this.supabaseUrl}/rest/v1/auth_codes?code=eq.${encodedValue}&select=*`;
    console.log('getAuthCode query URL:', url, 'original code:', code);
    
    const response = await fetch(url, {
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('getAuthCode error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('getAuthCode result:', data.length, 'records found', data);
    return data[0] || null;
  }

  async markAuthCodeUsed(code: string): Promise<void> {
    const encodedValue = encodeURIComponent(code);
    const url = `${this.supabaseUrl}/rest/v1/auth_codes?code=eq.${encodedValue}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
      body: JSON.stringify({ used: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('markAuthCodeUsed error:', response.status, errorText);
    }
  }

  // ==========================================================================
  // TOKENS
  // ==========================================================================

  async createToken(params: {
    access_token: string;
    refresh_token: string;
    client_id: string;
    user_email: string;
    resource: string;
    scope: string;
    access_token_expires_at: Date;
    refresh_token_expires_at: Date;
  }): Promise<Token> {
    const tokenId = `tok_${this.generateRandomString(16)}`;

    const payload: any = {
      token_id: tokenId,
      access_token: params.access_token,
      refresh_token: params.refresh_token,
      client_id: params.client_id,
      user_email: params.user_email,
      resource: params.resource,
      scope: params.scope,
      access_token_expires_at: params.access_token_expires_at.toISOString(),
      refresh_token_expires_at: params.refresh_token_expires_at.toISOString(),
      // MCP OAuth doesn't use agent_id or model (these are nullable for MCP)
      agent_id: null,
      model: null,
    };

    console.log('createToken payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${this.supabaseUrl}/rest/v1/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('createToken error:', response.status, errorData);
      throw new Error(`Failed to create token: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data[0];
  }

  async getTokenByAccessToken(accessToken: string): Promise<Token | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/tokens?access_token=eq.${accessToken}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  async getTokenByRefreshToken(refreshToken: string): Promise<Token | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/tokens?refresh_token=eq.${refreshToken}&select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  async revokeToken(token: string): Promise<void> {
    // Try to find by access_token or refresh_token
    await fetch(
      `${this.supabaseUrl}/rest/v1/tokens?or=(access_token.eq.${token},refresh_token.eq.${token})`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({ revoked: true }),
      }
    );
  }

  // ==========================================================================
  // USER AUTHORIZATIONS
  // ==========================================================================

  async createOrUpdateAuthorization(params: {
    user_email: string;
    server_id: string;
    client_id: string;
    granted_scopes: string[];
  }): Promise<void> {
    await fetch(`${this.supabaseUrl}/rest/v1/user_authorizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(params),
    });
  }

  async getAuthorization(
    userEmail: string,
    serverId: string,
    clientId: string
  ): Promise<UserAuthorization | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/user_authorizations?` +
      `user_email=eq.${userEmail}&` +
      `server_id=eq.${serverId}&` +
      `client_id=eq.${clientId}&` +
      `select=*`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    return data[0] || null;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array).map(x => chars[x % chars.length]).join('');
  }
}
