import { createHash, randomBytes } from 'node:crypto';

/**
 * PKCE (Proof Key for Code Exchange) Implementation
 * RFC 7636: https://www.rfc-editor.org/rfc/rfc7636.html
 */

/**
 * Generate PKCE code verifier
 * A cryptographically random string using [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 * with a minimum length of 43 characters and a maximum length of 128 characters
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes and encode as base64url (43 characters)
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from code verifier
 * S256: BASE64URL(SHA256(ASCII(code_verifier)))
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = createHash('sha256');
  hash.update(codeVerifier);
  return hash.digest('base64url');
}

/**
 * Verify PKCE code challenge
 * Used by authorization server to verify the code verifier
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: 'S256' = 'S256'
): boolean {
  if (codeChallengeMethod !== 'S256') {
    throw new Error('Only S256 code challenge method is supported');
  }

  const expectedChallenge = generateCodeChallenge(codeVerifier);
  return expectedChallenge === codeChallenge;
}

/**
 * Generate random state parameter for CSRF protection
 */
export function generateState(): string {
  return randomBytes(16).toString('base64url');
}
