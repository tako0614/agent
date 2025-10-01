import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

/**
 * Token Manager for OAuth 2.1 tokens
 * Handles secure storage and retrieval of access tokens and refresh tokens
 */

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  scope?: string[];
}

/**
 * Store tokens in secure HttpOnly cookies
 */
export function storeTokens(c: Context, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}): void {
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  // Store access token (short-lived)
  setCookie(c, 'access_token', tokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: tokens.expires_in,
    path: '/',
  });

  // Store refresh token (long-lived)
  setCookie(c, 'refresh_token', tokens.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  // Store token expiration time
  setCookie(c, 'token_expires_at', expiresAt.toString(), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: tokens.expires_in,
    path: '/',
  });

  // Store scope (optional, not sensitive)
  if (tokens.scope) {
    setCookie(c, 'token_scope', tokens.scope, {
      httpOnly: false, // Can be read by frontend
      secure: true,
      sameSite: 'Lax',
      maxAge: tokens.expires_in,
      path: '/',
    });
  }
}

/**
 * Get tokens from cookies
 */
export function getTokens(c: Context): TokenSet | null {
  const accessToken = getCookie(c, 'access_token');
  const refreshToken = getCookie(c, 'refresh_token');
  const expiresAtStr = getCookie(c, 'token_expires_at');
  const scopeStr = getCookie(c, 'token_scope');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtStr ? parseInt(expiresAtStr) : 0,
    scope: scopeStr ? scopeStr.split(' ') : undefined,
  };
}

/**
 * Get access token only
 */
export function getAccessToken(c: Context): string | null {
  return getCookie(c, 'access_token') || null;
}

/**
 * Get refresh token only
 */
export function getRefreshToken(c: Context): string | null {
  return getCookie(c, 'refresh_token') || null;
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(c: Context): boolean {
  const expiresAtStr = getCookie(c, 'token_expires_at');
  if (!expiresAtStr) {
    return true;
  }

  const expiresAt = parseInt(expiresAtStr);
  return Date.now() >= expiresAt;
}

/**
 * Clear all tokens from cookies
 */
export function clearTokens(c: Context): void {
  deleteCookie(c, 'access_token');
  deleteCookie(c, 'refresh_token');
  deleteCookie(c, 'token_expires_at');
  deleteCookie(c, 'token_scope');
}

/**
 * Store PKCE code verifier during authorization flow
 */
export function storeCodeVerifier(c: Context, codeVerifier: string): void {
  setCookie(c, 'code_verifier', codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
}

/**
 * Get and delete PKCE code verifier
 */
export function getAndDeleteCodeVerifier(c: Context): string | null {
  const codeVerifier = getCookie(c, 'code_verifier');
  if (codeVerifier) {
    deleteCookie(c, 'code_verifier');
  }
  return codeVerifier || null;
}

/**
 * Store OAuth state parameter during authorization flow
 */
export function storeState(c: Context, state: string): void {
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
}

/**
 * Get and delete OAuth state parameter
 */
export function getAndDeleteState(c: Context): string | null {
  const state = getCookie(c, 'oauth_state');
  if (state) {
    deleteCookie(c, 'oauth_state');
  }
  return state || null;
}
