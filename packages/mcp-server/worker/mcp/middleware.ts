import { MiddlewareHandler } from 'hono';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken, verifyMcpAccessToken, hasScope } from '../auth/verify';

/**
 * Authentication middleware for MCP tools
 * Implements OAuth 2.1 with RFC 9728 (Protected Resource Metadata)
 * Returns 401 with WWW-Authenticate header for unauthenticated requests
 */
export function middleware(handler: any): any {
  const app = handler;

  // Apply auth middleware to all routes
  app.use('/*', async (c: any, next: any) => {
    const databaseUrl = c.env.DATABASE_URL;
    const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-in-production';
    const issuer = c.env.MCP_ISSUER || 'http://localhost:8788';

    if (!databaseUrl) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    // Check for Bearer token (OAuth 2.1 standard)
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await prisma.$disconnect();
      
      // RFC 9728: Return 401 with WWW-Authenticate header pointing to PRM
      c.header('WWW-Authenticate', `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource"`);
      return c.json({ 
        error: 'unauthorized',
        error_description: 'Bearer token required. See WWW-Authenticate header for authentication details.'
      }, 401);
    }

    const token = authHeader.substring(7);
    
    try {
      // Try to verify as JWT (OAuth 2.1 standard)
      const payload = await verifyAccessToken(
        token,
        jwtSecret,
        issuer,
        issuer // For now, accept tokens issued for this server
      );
      
      // Get user info from database
      const user = await prisma.user.findUnique({
        where: { id: payload.sub }
      });

      if (!user) {
        await prisma.$disconnect();
        c.header('WWW-Authenticate', `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource", error="invalid_token", error_description="User not found"`);
        return c.json({ error: 'User not found' }, 401);
      }
      
      // Set user context from token
      c.set('auth', {
        type: 'oauth2',
        userId: payload.sub,
        clientId: payload.client_id,
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
    } catch (jwtError) {
      // JWT verification failed, try legacy MCP token (for backward compatibility)
      try {
        const payload = await verifyMcpAccessToken(prisma, token);
        
        // Get user info from database
        const user = await prisma.user.findUnique({
          where: { id: payload.userId }
        });

        if (!user) {
          await prisma.$disconnect();
          c.header('WWW-Authenticate', `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource", error="invalid_token"`);
          return c.json({ error: 'User not found' }, 401);
        }
        
        // Set user context from legacy token
        c.set('auth', {
          type: 'legacy-mcp-token',
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
      } catch (legacyError) {
        await prisma.$disconnect();
        c.header('WWW-Authenticate', `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource", error="invalid_token"`);
        return c.json({ 
          error: 'Invalid token',
          error_description: 'Token verification failed. Please obtain a new token from the authorization server.'
        }, 401);
      }
    }
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
