import { PrismaClient } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  scope: string[];
}

/**
 * Verify MCP Access Token from database
 */
export async function verifyMcpAccessToken(
  prisma: PrismaClient,
  token: string
): Promise<TokenPayload> {
  try {
    const mcpToken = await prisma.mcpAccessToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!mcpToken) {
      throw new Error('Token not found');
    }

    // Check expiration
    if (mcpToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.mcpAccessToken.delete({
        where: { id: mcpToken.id }
      });
      throw new Error('Token expired');
    }

    return {
      userId: mcpToken.userId,
      scope: mcpToken.scope
    };
  } catch (error) {
    console.error('Token verification error:', error);
    throw new Error(error instanceof Error ? error.message : 'Token verification failed');
  }
}

/**
 * Verify scope
 */
export function hasScope(requiredScope: string, userScopes: string[]): boolean {
  // Check for exact match
  if (userScopes.includes(requiredScope)) {
    return true;
  }
  
  // Check for wildcard match (e.g., "booking:*" matches "booking:read")
  const [resource] = requiredScope.split(':');
  return userScopes.includes(`${resource}:*`);
}
