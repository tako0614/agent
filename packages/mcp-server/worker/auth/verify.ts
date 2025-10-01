import * as jose from 'jose';

export interface TokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  scope: string[];
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Verify AI Service JWT Token
 */
export async function verifyAiServiceToken(
  token: string,
  publicKeyPem: string
): Promise<TokenPayload> {
  try {
    // Import public key
    const publicKey = await jose.importSPKI(publicKeyPem, 'RS256');

    // Verify JWT
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: 'ai-service.example.com',
      audience: 'mcp-api.example.com',
      algorithms: ['RS256']
    });

    // Validate required fields
    if (!payload.sub || !payload.scope || !Array.isArray(payload.scope)) {
      throw new Error('Invalid token payload');
    }

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return payload as unknown as TokenPayload;
  } catch (error) {
    console.error('Token verification error:', error);
    throw new Error(error instanceof Error ? error.message : 'Token verification failed');
  }
}

/**
 * Verify scope
 */
export function hasScope(requiredScope: string, userScopes: string[]): boolean {
  return userScopes.includes(requiredScope);
}
