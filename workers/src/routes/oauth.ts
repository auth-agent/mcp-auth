/**
 * OAuth 2.1 endpoints for Auth-Agent MCP
 * - /authorize - Authorization endpoint
 * - /token - Token endpoint
 * - /userinfo - UserInfo endpoint
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { Database } from '../lib/db';
import { generateJWT, validatePKCE, verifySecret, generateId } from '../lib/crypto';
import {
  isValidRedirectUri,
  isValidResource,
  isValidScope,
  isValidState,
  isValidCodeChallenge,
  isValidGrantType,
} from '../lib/validation';
import { consentPageHtml } from '../templates/consent';

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// AUTHORIZATION ENDPOINT
// ============================================================================

app.get('/authorize', async (c) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    response_type,
    scope = 'openid profile email',
    resource,  // RFC 8707 - MCP server URL
  } = c.req.query();

  // Validate required parameters
  if (!client_id || !redirect_uri || !state || !code_challenge || !response_type) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Missing required parameters'
    }, 400);
  }

  if (response_type !== 'code') {
    return c.json({
      error: 'unsupported_response_type',
      error_description: 'Only "code" response_type is supported'
    }, 400);
  }

  if (code_challenge_method !== 'S256') {
    return c.json({
      error: 'invalid_request',
      error_description: 'code_challenge_method must be S256'
    }, 400);
  }

  // Validate parameters format
  if (!isValidState(state)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid state parameter'
    }, 400);
  }

  if (!isValidCodeChallenge(code_challenge)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid code_challenge'
    }, 400);
  }

  if (!isValidScope(scope)) {
    return c.json({
      error: 'invalid_scope',
      error_description: 'Invalid scope format'
    }, 400);
  }

  // Validate resource parameter (RFC 8707)
  if (resource && !isValidResource(resource)) {
    return c.json({
      error: 'invalid_target',
      error_description: 'Invalid resource parameter'
    }, 400);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  // Validate client exists
  const client = await db.getClient(client_id);
  if (!client) {
    return c.json({
      error: 'invalid_client',
      error_description: 'Unknown client'
    }, 400);
  }

  // Validate redirect_uri is allowed (using allowed_redirect_uris from Auth-Agent schema)
  if (!client.allowed_redirect_uris.includes(redirect_uri)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'redirect_uri not registered for this client'
    }, 400);
  }

  if (!isValidRedirectUri(redirect_uri)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'redirect_uri must use HTTPS (except localhost)'
    }, 400);
  }

  // Validate resource is a registered MCP server
  let server = null;
  if (resource) {
    server = await db.getMcpServerByUrl(resource);
    if (!server) {
      return c.json({
        error: 'invalid_target',
        error_description: 'Unknown resource server'
      }, 400);
    }
  }

  // Create auth request
  const requestId = await db.createAuthRequest({
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
    resource,
  });

  // Return consent page
  const html = consentPageHtml({
    requestId,
    clientName: client.client_name,
    clientLogo: client.logo_url,
    scopes: scope.split(' '),
    serverName: server?.server_name,
    serverUrl: resource,
  });

  return c.html(html);
});

// ============================================================================
// OTP ENDPOINT (Send verification code)
// ============================================================================

app.post('/otp/send', async (c) => {
  const { email, request_id } = await c.req.json();

  if (!email || !request_id) {
    return c.json({ error: 'invalid_request', error_description: 'Missing email or request_id' }, 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: 'invalid_request', error_description: 'Invalid email format' }, 400);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  // Verify request_id is valid
  const authRequest = await db.getAuthRequest(request_id);
  if (!authRequest || authRequest.expires_at < new Date()) {
    return c.json({ error: 'expired_request', error_description: 'Authorization request expired' }, 400);
  }

  try {
    // Call Supabase Auth API to send OTP
    // Use magic link flow which works for both existing and new users
    const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.env.SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({
        email,
        create_user: true, // Allow user creation for OAuth flow
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('Supabase OTP error:', response.status, errorData);
      console.error('OTP request details:', { email, supabaseUrl: c.env.SUPABASE_URL });
      
      // Return more detailed error
      const errorMsg = errorData.message || errorData.error_description || errorData.error || errorText || 'Failed to send verification code';
      return c.json({
        error: 'otp_send_failed',
        error_description: errorMsg,
        details: errorData
      }, 500);
    }

    return c.json({ success: true, message: 'Verification code sent' });
  } catch (error: any) {
    console.error('OTP send error:', error);
    return c.json({
      error: 'otp_send_failed',
      error_description: error.message || 'Failed to send verification code'
    }, 500);
  }
});

// ============================================================================
// OTP VERIFY ENDPOINT
// ============================================================================

app.post('/otp/verify', async (c) => {
  const { email, token, request_id } = await c.req.json();

  if (!email || !token || !request_id) {
    return c.json({ error: 'invalid_request', error_description: 'Missing required parameters' }, 400);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  // Verify request_id is valid
  const authRequest = await db.getAuthRequest(request_id);
  if (!authRequest || authRequest.expires_at < new Date()) {
    return c.json({ error: 'expired_request', error_description: 'Authorization request expired' }, 400);
  }

  try {
    // Verify OTP with Supabase Auth API
    const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.env.SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({
        type: 'email',
        email,
        token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('Supabase verify error:', response.status, errorData);
      return c.json({
        error: 'invalid_code',
        error_description: errorData.message || errorData.error_description || 'Invalid or expired verification code'
      }, 400);
    }

    const verifyData = await response.json();
    console.log('OTP verified successfully for:', email);
    return c.json({ success: true, verified: true });
  } catch (error: any) {
    console.error('OTP verify error:', error);
    return c.json({
      error: 'verification_failed',
      error_description: error.message || 'Failed to verify code'
    }, 500);
  }
});

// ============================================================================
// CONSENT ENDPOINT (User approves/denies)
// ============================================================================

app.post('/consent', async (c) => {
  const { request_id, user_email, approved } = await c.req.json();

  if (!request_id || !user_email) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const authRequest = await db.getAuthRequest(request_id);

  if (!authRequest || authRequest.expires_at < new Date()) {
    return c.json({ error: 'expired_request' }, 400);
  }

  if (!approved) {
    // User denied consent - redirect with error
    const errorUrl = new URL(authRequest.redirect_uri);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('state', authRequest.state);
    return c.json({ redirect_uri: errorUrl.toString() });
  }

  try {
    // User approved - generate authorization code
    console.log('Creating auth code for request:', request_id);
    const code = await db.createAuthCode({
      client_id: authRequest.client_id,
      user_email,
      resource: authRequest.resource || '',
      redirect_uri: authRequest.redirect_uri,
      code_challenge: authRequest.code_challenge,
      scope: authRequest.scope,
    });
    console.log('Auth code created:', code);

    // Update auth request
    console.log('Updating auth request:', request_id);
    await db.updateAuthRequest(request_id, {
      user_email,
      authenticated: true,
      authorization_code: code,
    });

    // Save user authorization (for "previously authorized" UI)
    // This is non-blocking - if it fails, we still return the redirect
    if (authRequest.resource) {
      try {
        const server = await db.getMcpServerByUrl(authRequest.resource);
        if (server) {
          await db.createOrUpdateAuthorization({
            user_email,
            server_id: server.server_id,
            client_id: authRequest.client_id,
            granted_scopes: authRequest.scope.split(' '),
          });
        }
      } catch (authError: any) {
        // Log but don't fail - this is just for UI convenience
        console.warn('Failed to save user authorization (non-critical):', authError);
      }
    }

    // Redirect back to client with code
    const redirectUrl = new URL(authRequest.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', authRequest.state);

    console.log('Consent successful, redirecting to:', redirectUrl.toString());
    return c.json({ redirect_uri: redirectUrl.toString() });
  } catch (error: any) {
    console.error('Consent error:', error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'Failed to process consent';
    return c.json({
      error: 'consent_failed',
      error_description: errorMessage,
      details: error.stack || error.toString()
    }, 500);
  }
});

// ============================================================================
// TOKEN ENDPOINT
// ============================================================================

app.post('/token', async (c) => {
  try {
    const {
      grant_type,
      code,
      code_verifier,
      client_id,
      client_secret,
      redirect_uri,
      refresh_token,
      resource,  // RFC 8707
    } = await c.req.json();

    if (!isValidGrantType(grant_type)) {
      return c.json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code and refresh_token are supported'
      }, 400);
    }

    const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // ==========================================================================
    // AUTHORIZATION CODE GRANT
    // ==========================================================================

    if (grant_type === 'authorization_code') {
    if (!code || !code_verifier || !client_id || !redirect_uri) {
      return c.json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      }, 400);
    }

    // Validate client
    const client = await db.getClient(client_id);
    if (!client) {
      return c.json({ error: 'invalid_client' }, 401);
    }

    // Verify client_secret if provided (confidential client)
    if (client_secret && client.client_secret_hash) {
      const valid = await verifySecret(client_secret, client.client_secret_hash);
      if (!valid) {
        return c.json({ error: 'invalid_client' }, 401);
      }
    }

    // Get auth code
    console.log('Token exchange: looking up code:', code);
    const authCode = await db.getAuthCode(code);
    if (!authCode) {
      console.error('Token exchange: code not found:', code);
      return c.json({ error: 'invalid_grant', error_description: 'Invalid code' }, 400);
    }
    console.log('Token exchange: found auth code for user:', authCode.user_email);

    if (authCode.used) {
      return c.json({ error: 'invalid_grant', error_description: 'Code already used' }, 400);
    }

    if (authCode.expires_at < new Date()) {
      return c.json({ error: 'invalid_grant', error_description: 'Code expired' }, 400);
    }

    if (authCode.client_id !== client_id) {
      return c.json({ error: 'invalid_grant', error_description: 'Client mismatch' }, 400);
    }

    if (authCode.redirect_uri !== redirect_uri) {
      return c.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, 400);
    }

    // Validate PKCE
    const pkceValid = await validatePKCE(code_verifier, authCode.code_challenge, 'S256');
    if (!pkceValid) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid PKCE verifier' }, 400);
    }

    // Validate resource parameter matches (RFC 8707)
    if (resource && authCode.resource !== resource) {
      return c.json({
        error: 'invalid_target',
        error_description: 'Resource mismatch'
      }, 400);
    }

    // Mark code as used (single-use)
    await db.markAuthCodeUsed(code);

    // Generate tokens
    const accessToken = await generateJWT({
      sub: authCode.user_email,
      client_id,
      scope: authCode.scope,
      aud: authCode.resource,  // Audience claim (RFC 8707)
      expiresIn: 3600,  // 1 hour
      issuer: c.env.ISSUER_URL,
      secret: c.env.JWT_SECRET,
    });

    const refreshTokenValue = generateId('rt', 32);
    const accessTokenExpiresAt = new Date(Date.now() + 3600 * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days

    // Store tokens
    try {
      console.log('Creating token for user:', authCode.user_email);
      await db.createToken({
        access_token: accessToken,
        refresh_token: refreshTokenValue,
        client_id,
        user_email: authCode.user_email,
        resource: authCode.resource,
        scope: authCode.scope,
        access_token_expires_at: accessTokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
      });
      console.log('Token created successfully');
    } catch (tokenError: any) {
      console.error('Token creation error:', tokenError);
      return c.json({
        error: 'token_creation_failed',
        error_description: tokenError.message || 'Failed to create token'
      }, 500);
    }

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshTokenValue,
      scope: authCode.scope,
    });
  }

  // ==========================================================================
  // REFRESH TOKEN GRANT
  // ==========================================================================

  if (grant_type === 'refresh_token') {
    if (!refresh_token || !client_id) {
      return c.json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      }, 400);
    }

    // Validate client
    const client = await db.getClient(client_id);
    if (!client) {
      return c.json({ error: 'invalid_client' }, 401);
    }

    // Verify client_secret if provided
    if (client_secret && client.client_secret_hash) {
      const valid = await verifySecret(client_secret, client.client_secret_hash);
      if (!valid) {
        return c.json({ error: 'invalid_client' }, 401);
      }
    }

    // Get token record
    const tokenRecord = await db.getTokenByRefreshToken(refresh_token);
    if (!tokenRecord) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
    }

    if (tokenRecord.revoked) {
      return c.json({ error: 'invalid_grant', error_description: 'Token revoked' }, 400);
    }

    if (tokenRecord.refresh_token_expires_at < new Date()) {
      return c.json({ error: 'invalid_grant', error_description: 'Refresh token expired' }, 400);
    }

    if (tokenRecord.client_id !== client_id) {
      return c.json({ error: 'invalid_grant', error_description: 'Client mismatch' }, 400);
    }

    // Generate new tokens
    const newAccessToken = await generateJWT({
      sub: tokenRecord.user_email,
      client_id,
      scope: tokenRecord.scope,
      aud: tokenRecord.resource,
      expiresIn: 3600,
      issuer: c.env.ISSUER_URL,
      secret: c.env.JWT_SECRET,
    });

    const newRefreshToken = generateId('rt', 32);
    const accessTokenExpiresAt = new Date(Date.now() + 3600 * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    // Revoke old tokens (token rotation for security)
    await db.revokeToken(refresh_token);

    // Store new tokens
    await db.createToken({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      client_id,
      user_email: tokenRecord.user_email,
      resource: tokenRecord.resource,
      scope: tokenRecord.scope,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_expires_at: refreshTokenExpiresAt,
    });

    return c.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: tokenRecord.scope,
    });
  }

  return c.json({ error: 'unsupported_grant_type' }, 400);
  } catch (error: any) {
    console.error('Token endpoint error:', error);
    console.error('Error stack:', error.stack);
    return c.json({
      error: 'server_error',
      error_description: error.message || 'Internal server error'
    }, 500);
  }
});

// ============================================================================
// USERINFO ENDPOINT
// ============================================================================

app.get('/userinfo', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  const token = authHeader.substring(7);

  // Verify JWT (simplified - in production, check database too)
  const { verifyJWT } = await import('../lib/crypto');
  const decoded = await verifyJWT(token, c.env.JWT_SECRET);

  if (!decoded) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  // Check if token is revoked
  const db = new Database(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tokenRecord = await db.getTokenByAccessToken(token);

  if (!tokenRecord || tokenRecord.revoked) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  // Return user info based on scope
  const scopes = decoded.scope.split(' ');
  const userInfo: any = {
    sub: decoded.sub,
  };

  if (scopes.includes('email') || scopes.includes('openid')) {
    userInfo.email = decoded.sub;
  }

  if (scopes.includes('profile')) {
    // Add profile info if available
    userInfo.name = decoded.sub.split('@')[0]; // Simplified
  }

  return c.json(userInfo);
});

export { app as oauth };
