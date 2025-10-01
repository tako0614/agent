import { MiddlewareHandler } from 'hono';
import { PrismaClient } from '@prisma/client';
import { verifyMcpAccessToken, hasScope } from '../auth/verify';

/**
 * Authentication middleware for MCP tools
 * Supports both MCP access tokens and MCP admin sessions
 */
export function middleware(handler: any): any {
  const app = handler;

  // Apply auth middleware to all routes
  app.use('/*', async (c: any, next: any) => {
    const databaseUrl = c.env.DATABASE_URL;
    if (!databaseUrl) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    // Check for MCP Access Token (from AI Service)
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = await verifyMcpAccessToken(prisma, token);
        
        // Get user info from database
        const user = await prisma.user.findUnique({
          where: { id: payload.userId }
        });

        if (!user) {
          await prisma.$disconnect();
          return c.json({ error: 'User not found' }, 401);
        }
        
        // Set user context from token
        c.set('auth', {
          type: 'mcp-token',
          userId: payload.userId,
          scope: payload.scope,
          user: {
            id: user.id,
            email: user.email,
            name: user.name || ''
          }
        });
        
        c.set('prisma', prisma);
        await next();
        await prisma.$disconnect();
        return;
      } catch (error) {
        await prisma.$disconnect();
        return c.json({ error: 'Invalid token' }, 401);
      }
    }

    // Check for MCP admin session
    const cookies = c.req.header('Cookie');
    const sessionCookie = cookies?.split(';').find((c: string) => c.trim().startsWith('mcp_session='));
    
    if (sessionCookie) {
      try {
        const sessionToken = sessionCookie.split('=')[1];
        const sessionData = JSON.parse(atob(sessionToken));
        
        // Set admin context
        c.set('auth', {
          type: 'mcp-admin',
          userId: sessionData.userId,
          scope: ['*'], // Admin has all permissions
          user: {
            id: sessionData.userId,
            email: sessionData.email,
            name: sessionData.name,
            role: sessionData.role
          }
        });
        
        c.set('prisma', prisma);
        await next();
        await prisma.$disconnect();
        return;
      } catch (error) {
        await prisma.$disconnect();
        return c.json({ error: 'Invalid session' }, 401);
      }
    }

    await prisma.$disconnect();
    // No valid authentication
    return c.json({ error: 'Authentication required' }, 401);
  });

  return app;
}

/**
 * Require specific scope middleware
 */
export function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Admin has all scopes
    if (auth.type === 'mcp-admin' || auth.scope.includes('*')) {
      await next();
      return;
    }

    // Check if user has required scope
    if (!hasScope(scope, auth.scope)) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: scope,
        provided: auth.scope
      }, 403);
    }

    await next();
  };
}
