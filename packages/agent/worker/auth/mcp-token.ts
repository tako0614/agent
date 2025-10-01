import * as jose from 'jose';

export interface McpTokenPayload {
  iss: string; // Issuer: ai-service.example.com
  sub: string; // Subject: user ID
  aud: string; // Audience: mcp-api.example.com
  exp: number; // Expiration time
  iat: number; // Issued at
  scope: string[]; // Permissions
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Generate MCP access token for authenticated user
 * This token will be used to access MCP Server tools
 */
export async function generateMcpToken(
  userId: string,
  userEmail: string,
  userName: string,
  privateKeyPem: string,
  scope: string[] = [
    'booking:read',
    'booking:create',
    'booking:cancel',
    'product:read',
    'order:read',
    'order:create',
    'order:cancel',
    'form:read',
    'form:submit'
  ]
): Promise<string> {
  try {
    // Import private key for signing
    const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

    // Create JWT payload
    const payload: McpTokenPayload = {
      iss: 'ai-service.example.com',
      sub: userId,
      aud: 'mcp-api.example.com',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
      iat: Math.floor(Date.now() / 1000),
      scope,
      user: {
        id: userId,
        email: userEmail,
        name: userName
      }
    };

    // Sign and generate JWT
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(payload.iss)
      .setSubject(payload.sub)
      .setAudience(payload.aud)
      .setExpirationTime(payload.exp)
      .setIssuedAt(payload.iat)
      .sign(privateKey);

    return token;
  } catch (error) {
    console.error('Error generating MCP token:', error);
    throw new Error('Failed to generate MCP token');
  }
}

/**
 * Generate admin scope token (for admin users)
 */
export async function generateAdminMcpToken(
  userId: string,
  userEmail: string,
  userName: string,
  privateKeyPem: string
): Promise<string> {
  const adminScope = [
    'booking:*',
    'booking:admin',
    'product:*',
    'product:admin',
    'order:*',
    'order:admin',
    'form:*',
    'form:admin'
  ];

  return generateMcpToken(userId, userEmail, userName, privateKeyPem, adminScope);
}
