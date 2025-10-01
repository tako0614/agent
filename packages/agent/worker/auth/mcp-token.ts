import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

/**
 * Generate MCP access token for authenticated user
 * This token will be stored in database and used to access MCP Server tools
 */
export async function generateMcpToken(
  prisma: PrismaClient,
  userId: string,
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
    // Generate secure random token
    const token = randomBytes(32).toString('base64url');

    // Store token in database
    await prisma.mcpAccessToken.create({
      data: {
        userId,
        token,
        scope,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      }
    });

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
  prisma: PrismaClient,
  userId: string
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

  return generateMcpToken(prisma, userId, adminScope);
}

/**
 * Verify MCP access token
 */
export async function verifyMcpToken(
  prisma: PrismaClient,
  token: string
): Promise<{ userId: string; scope: string[] } | null> {
  try {
    const mcpToken = await prisma.mcpAccessToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!mcpToken) {
      return null;
    }

    // Check expiration
    if (mcpToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.mcpAccessToken.delete({
        where: { id: mcpToken.id }
      });
      return null;
    }

    return {
      userId: mcpToken.userId,
      scope: mcpToken.scope
    };
  } catch (error) {
    console.error('Error verifying MCP token:', error);
    return null;
  }
}

/**
 * Revoke MCP access token
 */
export async function revokeMcpToken(
  prisma: PrismaClient,
  token: string
): Promise<boolean> {
  try {
    await prisma.mcpAccessToken.delete({
      where: { token }
    });
    return true;
  } catch {
    return false;
  }
}
