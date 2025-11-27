/**
 * Cryptography utilities for Auth-Agent MCP
 * - PBKDF2 for secret hashing
 * - JWT generation and verification
 * - PKCE validation
 */

import * as jose from 'jose';
import type { JWTPayload } from '../types';

// ============================================================================
// PBKDF2 SECRET HASHING
// ============================================================================

/**
 * Hash a secret using PBKDF2 with 100k iterations
 */
export async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a secret against a PBKDF2 hash
 */
export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  const [saltHex, hashHex] = hash.split(':');
  if (!saltHex || !hashHex) return false;

  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const key = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  const computedHashArray = Array.from(new Uint8Array(derivedBits));
  const computedHashHex = computedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedHashHex === hashHex;
}

// ============================================================================
// JWT TOKENS
// ============================================================================

/**
 * Generate a JWT access token with HS256 signing
 */
export async function generateJWT(params: {
  sub: string;
  client_id: string;
  scope: string;
  aud: string;  // RFC 8707 - resource/audience
  expiresIn: number;
  issuer: string;
  secret: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(params.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const jwt = await new jose.SignJWT({
    sub: params.sub,
    client_id: params.client_id,
    scope: params.scope,
    aud: params.aud,  // Audience claim (RFC 8707)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(params.issuer)
    .setIssuedAt()
    .setExpirationTime(`${params.expiresIn}s`)
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode a JWT access token
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// ============================================================================
// PKCE (Proof Key for Code Exchange)
// ============================================================================

/**
 * Generate a random code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

/**
 * Generate code challenge from verifier using S256 method
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(hashBuffer));
}

/**
 * Validate PKCE code_verifier against code_challenge
 */
export async function validatePKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): Promise<boolean> {
  if (method !== 'S256') {
    return false;
  }

  const computedChallenge = await generateCodeChallenge(codeVerifier);
  return computedChallenge === codeChallenge;
}

// ============================================================================
// RANDOM GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(x => chars[x % chars.length]).join('');
}

/**
 * Generate a random ID with prefix
 */
export function generateId(prefix: string, length: number = 24): string {
  return `${prefix}_${generateRandomString(length)}`;
}

// ============================================================================
// BASE64URL ENCODING
// ============================================================================

function base64urlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...Array.from(buffer)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
