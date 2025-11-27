/**
 * Validation utilities for Auth-Agent MCP
 */

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate redirect URI (HTTPS required except localhost)
 */
export function isValidRedirectUri(uri: string): boolean {
  if (!isValidUrl(uri)) return false;

  const url = new URL(uri);

  // HTTP is only allowed for localhost
  if (url.protocol === 'http:') {
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  }

  return url.protocol === 'https:';
}

/**
 * Validate resource parameter (RFC 8707)
 * Must be a valid HTTPS URL without fragment
 */
export function isValidResource(resource: string): boolean {
  if (!isValidUrl(resource)) return false;

  const url = new URL(resource);

  // Must be HTTPS (or HTTP for localhost in dev)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }

  // No fragment allowed
  if (url.hash) {
    return false;
  }

  return true;
}

/**
 * Validate scope string format
 */
export function isValidScope(scope: string): boolean {
  if (!scope || typeof scope !== 'string') return false;

  // Scopes should be space-separated tokens
  const scopes = scope.split(' ');
  return scopes.every(s => /^[a-zA-Z0-9_:.-]+$/.test(s));
}

/**
 * Validate client ID format
 */
export function isValidClientId(clientId: string): boolean {
  // client_xxx format or URL for Client ID Metadata Documents
  return /^client_[a-zA-Z0-9_-]+$/.test(clientId) || isValidUrl(clientId);
}

/**
 * Validate state parameter (CSRF token)
 */
export function isValidState(state: string): boolean {
  // State should be at least 8 characters
  return typeof state === 'string' && state.length >= 8;
}

/**
 * Validate PKCE code challenge
 */
export function isValidCodeChallenge(challenge: string): boolean {
  // Base64url encoded, 43-128 characters
  return (
    typeof challenge === 'string' &&
    challenge.length >= 43 &&
    challenge.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(challenge)
  );
}

/**
 * Validate grant type
 */
export function isValidGrantType(grantType: string): boolean {
  return ['authorization_code', 'refresh_token'].includes(grantType);
}

/**
 * Parse and validate scopes
 */
export function parseScopes(scope: string): string[] {
  if (!isValidScope(scope)) return [];
  return scope.split(' ').filter(s => s.length > 0);
}

/**
 * Check if granted scopes include all required scopes
 */
export function hasRequiredScopes(
  grantedScopes: string[],
  requiredScopes: string[]
): boolean {
  return requiredScopes.every(scope => grantedScopes.includes(scope));
}
