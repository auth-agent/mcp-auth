/**
 * TypeScript type definitions for Auth-Agent MCP
 */

export interface McpServer {
  id: string;
  server_id: string;
  server_url: string;
  server_name: string;
  description?: string;
  scopes: string[];
  logo_url?: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface McpServerKey {
  id: string;
  key_id: string;
  key_hash: string;
  server_id: string;
  name: string;
  last_used_at?: Date;
  created_at: Date;
  expires_at?: Date;
}

export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret_hash: string;  // NOT NULL in Auth-Agent schema
  client_name: string;
  client_type?: 'website' | 'mcp_client';
  allowed_redirect_uris: string[];  // Matches Auth-Agent schema
  logo_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthRequest {
  id: string;
  request_id: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  resource?: string;
  user_email?: string;
  authenticated: boolean;
  authorization_code?: string;
  created_at: Date;
  expires_at: Date;
}

export interface AuthCode {
  id: string;
  code: string;
  client_id: string;
  user_email: string;
  resource: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  used: boolean;
  created_at: Date;
  expires_at: Date;
}

export interface Token {
  id: string;
  token_id: string;
  access_token: string;
  refresh_token: string;
  client_id: string;
  user_email: string;
  resource: string;
  scope: string;
  revoked: boolean;
  access_token_expires_at: Date;
  refresh_token_expires_at: Date;
  created_at: Date;
}

export interface UserAuthorization {
  id: string;
  user_email: string;
  server_id: string;
  client_id: string;
  granted_scopes: string[];
  last_used_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

export interface JWTPayload {
  sub: string;  // user_email
  client_id: string;
  scope: string;
  aud: string;  // resource (RFC 8707)
  iss: string;
  iat: number;
  exp: number;
}

export interface IntrospectionResponse {
  active: boolean;
  sub?: string;
  client_id?: string;
  scope?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface ErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}
